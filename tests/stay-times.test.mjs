import test from "node:test";
import assert from "node:assert/strict";
import { compile, hooks, jsx, nodes } from "./helpers/runtime.mjs";

const times = compile("src/app/utils/stayTimes.ts");

test("stay times format midnight/noon without timezone conversion and reject invalid input", () => {
  for (const [input, expected] of [
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["14:30", "2:30 PM"],
    ["23:59", "11:59 PM"],
  ]) {
    assert.equal(times.formatStayTime(input), expected);
  }
  for (const invalid of ["", "24:00", "14:60", "2:00", "14:00:00", null])
    assert.equal(times.isStayTime(invalid), false);
});

test("public stay settings update live and report read errors instead of silently completing a booking", () => {
  const runtime = hooks();
  let receive,
    fail,
    cleaned = false;
  const { useResortSettings } = compile("src/hooks/useResortSettings.tsx", {
    react: runtime.api,
    "../app/components/firebase": { db: {} },
    "../app/utils/stayTimes": times,
    "firebase/firestore": {
      doc: (_db, collection, id) => {
        assert.equal(collection, "publicSettings");
        assert.equal(id, "general");
      },
      onSnapshot: (_ref, next, error) => {
        receive = next;
        fail = error;
        return () => {
          cleaned = true;
        };
      },
    },
  });
  function render() {
    runtime.reset();
    const result = useResortSettings();
    runtime.flush();
    return result;
  }
  assert.equal(render().loading, true);
  receive({
    exists: () => true,
    data: () => ({ checkInTime: "15:30", checkOutTime: "12:00" }),
  });
  assert.equal(render().settings.checkInTime, "15:30");
  assert.equal(render().settings.checkOutTime, "12:00");
  fail(Error("Permission denied"));
  assert.match(render().error, /Unable to load/);
  receive({
    exists: () => true,
    data: () => ({ checkInTime: "16:00", checkOutTime: "invalid" }),
  });
  assert.equal(render().error, "");
  assert.equal(render().settings.checkInTime, "16:00");
  assert.equal(render().settings.checkOutTime, "11:00");
  runtime.cleanup();
  assert.equal(cleaned, true);
});

function confirmation(booking, settingsState) {
  const runtime = hooks();
  const Page = compile("src/app/pages/BookingConfirmation.tsx", {
    react: runtime.api,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-router": {
      useParams: () => ({ id: "booking" }),
      Link: "link",
      useNavigate: () => () => {},
    },
    "../../hooks/useResortSettings": { useResortSettings: () => settingsState },
    "../utils/stayTimes": times,
    "../utils/activityAvailability": compile(
      "src/app/utils/activityAvailability.ts",
    ),
    "../utils/bookingPresentation": compile(
      "src/app/utils/bookingPresentation.ts",
    ),
    "../components/firebase": { customerDb: {} },
    "lucide-react": {},
    "firebase/firestore": {
      doc: () => "booking",
      onSnapshot: (_ref, next) => {
        next({ exists: () => true, id: "booking", data: () => booking });
        return () => {};
      },
    },
  }).default;
  function render() {
    runtime.reset();
    const result = nodes(Page());
    runtime.flush();
    return result;
  }
  render();
  return render();
}

test("confirmation preserves agreed booking times and falls back to live settings for older bookings", () => {
  const settingsState = {
    settings: { checkInTime: "16:00", checkOutTime: "10:00" },
    loading: false,
    error: "",
  };
  const saved = confirmation(
    { checkInTime: "15:30", checkOutTime: "12:00" },
    settingsState,
  );
  assert.ok(saved.some((node) => node.props.children === "From 3:30 PM"));
  assert.ok(saved.some((node) => node.props.children === "Until 12:00 PM"));
  const legacy = confirmation({}, settingsState);
  assert.ok(legacy.some((node) => node.props.children === "From 4:00 PM"));
  assert.ok(legacy.some((node) => node.props.children === "Until 10:00 AM"));
  const activity = confirmation(
    { bookingType: "service", bookingTime: "09:00" },
    settingsState,
  );
  assert.equal(
    activity.some((node) => String(node.props.children).startsWith("From ")),
    false,
  );
});
