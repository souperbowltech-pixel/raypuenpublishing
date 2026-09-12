/**
 * MailerLite integration helper for Puen Publishing.
 */
export async function addSubscriberToMailerLite(params: {
  email: string;
  name?: string;
  groupId?: string;
  fields?: Record<string, any>;
}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.warn("MAILERLITE_API_KEY is not configured.");
    return null;
  }

  const payload: Record<string, any> = {
    email: params.email,
  };

  if (params.name) {
    payload.fields = { name: params.name, ...(params.fields || {}) };
  } else if (params.fields) {
    payload.fields = params.fields;
  }

  if (params.groupId) {
    payload.groups = [params.groupId];
  }

  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("MailerLite addSubscriber error:", error);
    return null;
  }
}
