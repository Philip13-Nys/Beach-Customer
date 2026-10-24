import { Turnstile } from "@marsidev/react-turnstile";

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

export default function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return (
      <p className="text-sm text-red-600">Turnstile site key is missing.</p>
    );
  }
  console.log(
    "Turnstile Site Key:",
    import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY,
  );
  return (
    <div className="my-4">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onVerify}
        onExpire={onExpire}
        onError={onError}
        options={{
          theme: "light",
          size: "flexible",
        }}
      />
    </div>
  );
}
