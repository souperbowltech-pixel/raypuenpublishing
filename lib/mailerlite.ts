/**
 * MailerLite integration helper for Puen Publishing.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const email = params.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    console.error("[MailerLite] Invalid email address, skipping sync:", params.email);
    return null;
  }

  // Custom `fields` (e.g. order_type, stripe_session_id) may not be declared in
  // the MailerLite schema; combine them with the standard `name` field.
  const subscriberFields: Record<string, any> = { ...(params.fields || {}) };
  if (params.name) {
    subscriberFields.name = params.name;
  }

  const basePayload: Record<string, any> = {
    email,
    // Always create as "active" so the subscriber appears in the Active list
    // even when Double Opt-in is enabled on the account.
    status: "active",
  };
  if (params.groupId) {
    basePayload.groups = [params.groupId];
  }

  const hasFields = Object.keys(subscriberFields).length > 0;

  async function post(withFields: boolean) {
    const payload: Record<string, any> = { ...basePayload };
    if (withFields && hasFields) {
      payload.fields = subscriberFields;
    }
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  try {
    let { res, data } = await post(true);

    // 422 = MailerLite rejected an undeclared custom field. Retry once without
    // the custom fields so the subscribe still succeeds.
    if (res.status === 422 && hasFields) {
      console.error("[MailerLite API Error]:", res.status, data, "— retrying without custom fields");
      ({ res, data } = await post(false));
    }

    if (!res.ok) {
      console.error("[MailerLite API Error]:", res.status, data);
    } else {
      console.log(`[MailerLite] Subscriber synced successfully: ${email} (ID: ${data?.data?.id})`);
    }
    return data;
  } catch (error) {
    console.error("[MailerLite] Network error:", error);
    return null;
  }
}
