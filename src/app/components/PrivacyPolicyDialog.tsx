import { useResortSettings } from "../../hooks/useResortSettings";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";

function PrivacyPolicyContent() {
  const { settings } = useResortSettings();
  const email = settings.email || "sabangbeach@gmail.com";

  return (
    <>
      <DialogTitle className="pr-8 text-xl text-primary">Privacy Policy</DialogTitle>
      <DialogDescription>
        How {settings.resortName} uses information in the customer booking website.
      </DialogDescription>

      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        <section>
          <h3 className="mb-1 font-semibold">Accounts, bookings, and payments</h3>
          <p>We use your name, email, phone number, and account details to manage your account and contact you about your reservations. We use your booking details and GCash payment reference to manage availability, reservations, and payment verification.</p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Inquiries, reviews, and chat</h3>
          <p>We use the information you send in inquiries to respond to your questions. Published reviews can display your name, photo, rating, and feedback. Messages you send to the AI assistant go to its service to generate a response. Your browser stores chat history, and signed-in chat history can sync through Firebase.</p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Services used by the website</h3>
          <p>The website uses Firebase for sign-in and data storage, Google when you choose Google Sign-In, and Cloudflare Turnstile to help detect automated requests.</p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Questions and privacy requests</h3>
          <p>
            Contact the resort at <a href={`mailto:${email}`} className="break-words text-primary underline">{email}</a>{" "}
            to ask about retention or request access to, correction of, or deletion of your personal information. You can also contact the Philippine National Privacy Commission about privacy concerns.
          </p>
        </section>
      </div>
    </>
  );
}

export default function PrivacyPolicyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="cursor-pointer text-sm font-normal leading-5 whitespace-nowrap text-primary underline underline-offset-2 hover:text-accent">
          Privacy Policy
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <PrivacyPolicyContent />
      </DialogContent>
    </Dialog>
  );
}
