import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { log } from "dbc-node-logger";

type FeedbackMessage = {
  role?: string;
  content?: unknown;
  date?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { feedbackText, messages = [], maskName = "Ukendt" } = body as {
      feedbackText?: string;
      messages?: FeedbackMessage[];
      maskName?: string;
    };

    if (!feedbackText) {
      return NextResponse.json(
        { error: "Feedback text is required" },
        { status: 400 },
      );
    }

    const feedbackMail = process.env.FEEDBACK_MAIL;
    if (!feedbackMail) {
      log.error("Error in feedback endpoint. env.FEEDBACK_MAIL is not set");
      return NextResponse.json(
        { error: "Feedback recipient is not configured" },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
    });

    const conversationHtml = messages
      .map(
        (message) => `
          <li>
            <strong>${escapeHtml(message.role)}</strong>
            <span>${escapeHtml(message.date)}</span>
            <pre>${escapeHtml(formatMessageContent(message.content))}</pre>
          </li>
        `,
      )
      .join("");

    await transporter.sendMail({
      from: process.env.FEEDBACK_FROM || feedbackMail,
      to: feedbackMail,
      subject: `Feedback (${maskName})`,
      html: `
        <h2 style="color: #333;">Ny Feedback</h2>
        <p><strong>Assistent:</strong> ${escapeHtml(maskName)}</p>
        <h3 style="color: #0056b3;">Feedback tekst:</h3>
        <p style="white-space: pre-wrap;">${escapeHtml(feedbackText)}</p>
        ${
          messages.length > 0
            ? `<h3 style="color: #0056b3;">Vedhæftet samtale:</h3><ol>${conversationHtml}</ol>`
            : ""
        }
      `,
    });

    return NextResponse.json({ success: true, message: "Feedback received" });
  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      { error: "An error occurred while processing feedback" },
      { status: 500 },
    );
  }
}
