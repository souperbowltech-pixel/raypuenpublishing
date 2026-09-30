import { NextRequest, NextResponse } from "next/server";
import { reviewGuideApproval } from "@/lib/patrol-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Ray's one-click approval of a free printed Parent's Guide.
 *
 * **GET only asks; POST decides.** The approval used to happen on GET, which
 * meant anything that fetches a link without a human — a mail scanner, an
 * antivirus checker, a chat app drawing a preview — could approve a claim before
 * Ray ever saw it. Those all issue GETs and never POST, so the decision now sits
 * behind a button.
 *
 * The approval token is the credential: it is single-purpose, unguessable and
 * arrives in his email, so he can act from a phone with nothing else to hand.
 */

const page = (title: string, body: string, accent = "#2E6B5E") =>
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title} — Puen Publishing</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FCF8F1; color: #26211C; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
      .card { background: #fff; border: 2px solid ${accent}; border-radius: 20px; max-width: 520px; width: 100%; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,.06); }
      h1 { font-size: 22px; margin: 0 0 12px; color: ${accent}; }
      p { color: #5A5148; line-height: 1.6; font-size: 16px; }
      dl { background: #F4EBDD; border-radius: 12px; padding: 16px; margin: 20px 0; }
      dt { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #5A5148; margin-top: 10px; }
      dt:first-child { margin-top: 0; }
      dd { margin: 2px 0 0; font-weight: 600; white-space: pre-line; }
      button { font: inherit; font-weight: 700; border: 0; border-radius: 999px; padding: 14px 22px; cursor: pointer; width: 100%; }
      .approve { background: #2E6B5E; color: #fff; }
      .reject { background: transparent; color: #B34738; border: 2px solid #B34738; margin-top: 10px; }
      form { margin: 0; }
    </style>
  </head>
  <body><div class="card">${body}</div></body>
</html>`;

const html = (content: string, status = 200) =>
  new NextResponse(content, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Ask. Never decide. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action") === "reject" ? "reject" : "approve";

  if (!token) {
    return html(page("Invalid request", `<h1>Something is missing</h1><p>This link has no approval reference in it. Please open the link from your email again.</p>`, "#B34738"), 400);
  }

  const verb = action === "approve" ? "Approve" : "Decline";
  return html(
    page(
      `${verb} this claim?`,
      `<h1>${verb} this free Parent's Guide?</h1>
       <p>Nothing has happened yet. Press the button below to ${action === "approve" ? "approve this claim and queue the Guide for printing" : "decline this claim"}.</p>
       <form method="POST">
         <input type="hidden" name="token" value="${escape(token)}" />
         <input type="hidden" name="action" value="${action}" />
         <button type="submit" class="${action === "approve" ? "approve" : "reject"}">${verb} it</button>
       </form>`,
      action === "approve" ? "#2E6B5E" : "#B34738"
    )
  );
}

/** Decide. */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`admin-approve:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return html(page("Too many attempts", `<h1>Too many attempts</h1><p>Please wait a minute and try again.</p>`, "#B34738"), 429);
  }

  const form = await req.formData();
  const token = String(form.get("token") || "");
  const action = form.get("action") === "reject" ? "reject" : "approve";

  if (!token) {
    return html(page("Invalid request", `<h1>Something is missing</h1><p>No approval reference was sent.</p>`, "#B34738"), 400);
  }

  const result = await reviewGuideApproval(token, action);

  if (!result.ok) {
    return html(
      page("Could not do that", `<h1>Could not do that</h1><p>${escape(result.error || "The claim could not be processed. It may already have been decided.")}</p>`, "#B34738"),
      400
    );
  }

  const approved = result.status === "approved";
  return html(
    page(
      approved ? "Approved" : "Declined",
      `<h1>${approved ? "Approved" : "Declined"}</h1>
       <p>${
         approved
           ? "The free printed Parent's Guide has been approved and queued for print fulfilment."
           : "The claim has been declined. Nothing will be printed or posted."
       }</p>`,
      approved ? "#2E6B5E" : "#B34738"
    )
  );
}
