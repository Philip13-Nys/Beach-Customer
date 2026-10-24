export async function verifyTurnstile(token: string): Promise<boolean> {
  const workerUrl = import.meta.env.VITE_TURNSTILE_VERIFY_URL;

  if (!workerUrl || !token) {
    return false;
  }

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();

    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
