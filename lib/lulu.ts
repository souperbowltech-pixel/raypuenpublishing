/**
 * LULU PRINT-ON-DEMAND API CLIENT
 */

interface LuluTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  postcode: string;
  phone_number?: string;
}

export interface LuluPrintJobParams {
  externalId: string;
  shippingLevel?: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND_HD' | 'EXPEDITED';
  shippingAddress: ShippingAddress;
  contactEmail: string;
  lineItems: Array<{
    title: string;
    coverUrl: string;
    interiorUrl: string;
    podPackageId: string;
    quantity: number;
  }>;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getLuluAccessToken(): Promise<string | null> {
  const clientKey = process.env.LULU_CLIENT_KEY;
  const clientSecret = process.env.LULU_CLIENT_SECRET;
  const baseUrl = process.env.LULU_API_BASE_URL || 'https://api.sandbox.lulu.com';

  if (!clientKey || !clientSecret) {
    console.warn('[Lulu API] Missing LULU_CLIENT_KEY or LULU_CLIENT_SECRET');
    return null;
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const authHeader = Buffer.from(${clientKey}:).toString('base64');
    const tokenUrl = ${baseUrl}/auth/realms/glasstree/protocol/openid-connect/token;

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: Basic ,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Lulu API] Token request failed:', res.status, errText);
      return null;
    }

    const data: LuluTokenResponse = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  } catch (err) {
    console.error('[Lulu API] Token request exception:', err);
    return null;
  }
}

export async function createLuluPrintJob(params: LuluPrintJobParams) {
  const token = await getLuluAccessToken();
  const baseUrl = process.env.LULU_API_BASE_URL || 'https://api.sandbox.lulu.com';

  if (!token) {
    return { success: false, error: 'Unable to authenticate with Lulu API' };
  }

  const payload = {
    external_id: params.externalId,
    line_items: params.lineItems.map((item) => ({
      title: item.title,
      cover: item.coverUrl,
      interior: item.interiorUrl,
      pod_package_id: item.podPackageId,
      quantity: item.quantity,
    })),
    shipping_address: {
      name: params.shippingAddress.name,
      street1: params.shippingAddress.street1,
      street2: params.shippingAddress.street2,
      city: params.shippingAddress.city,
      country_code: params.shippingAddress.country_code,
      state_code: params.shippingAddress.state_code,
      postcode: params.shippingAddress.postcode,
      phone_number: params.shippingAddress.phone_number,
    },
    shipping_level: params.shippingLevel || 'MAIL',
    contact_email: params.contactEmail,
  };

  try {
    const res = await fetch(${baseUrl}/print-jobs/, {
      method: 'POST',
      headers: {
        Authorization: Bearer ,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Lulu API] Print job creation error:', res.status, data);
      return { success: false, status: res.status, error: data };
    }

    return { success: true, printJob: data };
  } catch (err: any) {
    console.error('[Lulu API] Print job exception:', err);
    return { success: false, error: err.message };
  }
}
