import assert from "node:assert/strict";
import test from "node:test";
import * as dateFns from "date-fns";
import { compile, hooks, jsx, nodes, settle } from "./helpers/runtime.mjs";

const checkIn = "2026-11-16";
const checkOut = "2026-11-17";
const selection = new URLSearchParams({ checkIn, checkOut, guests: "3" });

function mount(page, path, search, user, state = null, authLoading = false) {
  const runtime = hooks();
  const navigation = [];
  const Page = compile(`src/app/pages/${page}.tsx`, {
    react: runtime.api,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "date-fns": dateFns,
    "../../hooks/useAsyncAction": { useAsyncAction: () => ({ pending: false }) },
    "../context/AppContext": { useApp: () => ({ user, authLoading }) },
    "../components/firebase": { auth: {}, db: {}, customerDb: {} },
    "react-router": {
      Link: "link",
      useParams: () => ({ id: "suite" }),
      useLocation: () => ({ pathname: path, state }),
      useSearchParams: () => [new URLSearchParams(search)],
      useNavigate: () => (url, options) => navigation.push({ url, options }),
    },
    "lucide-react": {},
    "firebase/firestore": {
      doc: (_db, collection) => collection,
      collection: (_db, name) => name,
      getDoc: async (name) => ({
        exists: () => name === "roomTypes",
        id: "suite",
        data: () => ({ name: "Suite Room", count: 1, basePrice: 12000, maxGuests: 4 }),
      }),
      getDocs: async (name) => ({
        docs: name === "rooms" ? [{ data: () => ({ roomTypeId: "suite" }) }] : [],
        forEach() {},
      }),
    },
  }, {
    URLSearchParams,
    Date: class extends Date {
      constructor(...args) {
        if (args.length) super(...args);
        else super(2026, 10, 6, 0, 30);
      }
    },
  }).default;

  function render() {
    runtime.reset();
    const tree = nodes(Page());
    runtime.flush();
    return tree;
  }

  return { render, navigation };
}

async function loaded(view) {
  view.render();
  await settle();
  view.render();
  await settle();
  return view.render();
}

const dateFields = (tree) => tree.filter((node) => node.type === "input" && node.props.type === "date");

test("room details carry the selected stay into booking and through sign-in", async () => {
  const user = { id: "guest" };
  for (const signedIn of [false, true]) {
    const detail = mount("RoomDetail", "/rooms/suite", selection, signedIn ? user : null);
    const tree = await loaded(detail);
    tree.find((node) => node.type === "button" && node.props.children === "Reserve This Room").props.onClick();
    const [next] = detail.navigation;
    if (!signedIn) assert.equal(next.url, "/auth");
    const target = new URL(signedIn ? next.url : next.options.state.returnTo, "https://example.test");
    assert.equal(target.pathname, "/booking/suite");
    assert.deepEqual(Object.fromEntries(target.searchParams), Object.fromEntries(selection));

    const booking = mount("Booking", target.pathname, target.search, user);
    const form = await loaded(booking);
    assert.deepEqual(dateFields(form).map((field) => field.props.value), [checkIn, checkOut]);
    const back = form.find((node) => node.type === "link" && node.props.to.startsWith("/rooms/suite?"));
    assert.deepEqual(Object.fromEntries(new URL(back.props.to, "https://example.test").searchParams), Object.fromEntries(selection));
  }
});

test("booking supports the older navigation state and advances checkout by one calendar day", async () => {
  const booking = mount("Booking", "/booking/suite", "", { id: "guest" }, { checkIn, checkOut, guests: 3 });
  const fields = dateFields(await loaded(booking));
  assert.deepEqual(fields.map((field) => field.props.value), [checkIn, checkOut]);
  fields[0].props.onChange({ target: { value: "2026-11-30" } });
  assert.deepEqual(dateFields(booking.render()).map((field) => field.props.value), ["2026-11-30", "2026-12-01"]);
});

test("direct booking waits for authentication and keeps the stay in the login destination", async () => {
  const loading = mount("Booking", "/booking/suite", selection, null, null, true);
  await loaded(loading);
  assert.equal(loading.navigation.length, 0);

  const booking = mount("Booking", "/booking/suite", selection, null);
  await loaded(booking);
  const [redirect] = booking.navigation;
  assert.equal(redirect.url, "/auth");
  const target = new URL(redirect.options.state.returnTo, "https://example.test");
  assert.equal(target.pathname, "/booking/suite");
  assert.deepEqual(Object.fromEntries(target.searchParams), Object.fromEntries(selection));
});
