import { NextRequest, NextResponse } from "next/server";
import { reviewGuideApproval } from "@/lib/patrol-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action") === "reject" ? "reject" : "approve";

  if (!token) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Invalid Request</h2><p>Approval token is missing.</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const result = await reviewGuideApproval(token, action);

  if (!result.ok) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Action Failed</h2><p>${result.error || "Could not process request."}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const isApproved = result.status === "approved";
  const title = isApproved ? "✅ Guide Claim Approved!" : "❌ Guide Claim Rejected";
  const message = isApproved
    ? "The Free Printed Parent's Guide reward has been approved and queued for print fulfillment."
    : "The claim has been rejected.";

  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title} - Puen Publishing</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FCF8F1; color: #2B2621; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #FFFFFF; border: 2px solid ${isApproved ? "#2E6B5E" : "#B34738"}; border-radius: 20px; max-width: 500px; width: 100%; padding: 36px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
          h1 { font-size: 24px; margin-top: 0; color: ${isApproved ? "#2E6B5E" : "#B34738"}; }
          p { color: #5A5148; line-height: 1.6; font-size: 16px; }
          .badge { display: inline-block; background: ${isApproved ? "#2E6B5E" : "#B34738"}; color: #fff; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${isApproved ? "Approved" : "Rejected"}</div>
          <h1>${title}</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
