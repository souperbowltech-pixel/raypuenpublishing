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
    console.warn("[MailerLite] MAILERLITE_API_KEY is not configured.");
    return null;
  }

  const payload: Record<string, any> = {
    email: params.email.trim().toLowerCase(),
  };

  // Only pass standard known fields to prevent MailerLite schema rejections
  const subscriberFields: Record<string, any> = {};
  if (params.name) {
    subscriberFields.name = params.name;
  }
  if (Object.keys(subscriberFields).length > 0) {
    payload.fields = subscriberFields;
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
    if (!res.ok) {
      console.error("[MailerLite API Error]:", res.status, data);
    } else {
      console.log(`[MailerLite] Subscriber synced successfully: ${params.email} (ID: ${data?.data?.id})`);
    }
    return data;
  } catch (error) {
    console.error("[MailerLite] Network error:", error);
    return null;
  }
}
