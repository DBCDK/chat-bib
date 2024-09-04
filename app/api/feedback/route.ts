import { decodeValue } from "@/app/dbc/components/constants";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { log } from "dbc-node-logger";

/**
 * removes component prefixes and suffixes. Ex. PluginStatusComponent_dbc etc.
 * @param inputText
 * @returns
 */
function cleanText(inputText: string): string {
  const cleanedText = inputText
    .replace(/PluginStatusComponent_dbc-general-model_/g, "\n")
    .replace(/_?\[\]/g, "\n")
    .trim();

  return cleanedText;
}

// This function will handle POST requests to /api/feedback
async function handle(req: Request) {
  try {
    const body = await req.json();
    const { feedbackText, messages } = body;
    if (!feedbackText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: "mailhost.dbc.dk",
      port: 25,
      secure: false,
      pool: true,
      maxMessages: Infinity,
      maxConnections: 20,
    });
    const chatbibMail = process.env.FEEDBACK_MAIL;

    if (!chatbibMail) {
      //todo error dbc log
      log.error("Error in feedback endpoint. env.FEEDBACK_MAIL is not set");
      return NextResponse.json({
        success: false,
        message: "Something went wrong.",
      });
    }
    const parsedMessages = JSON.parse(messages);
    const mailOptions = {
      from: chatbibMail,
      to: chatbibMail,
      subject: "Chatbib feedback",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #333;">Ny Feedback</h2>
        
        <h3 style="color: #0056b3;">Feedback tekst:</h3>
        <p style="margin-bottom: 20px;">
          ${feedbackText}
        </p>
        
        <h3 style="color: #0056b3;">Chat:</h3>
        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
          ${parsedMessages
            ?.map((message: any) => {
              const formatedMessage = cleanText(message.content); //extractText(message.content);
              return `
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; color: ${message.role === "user" ? "#007bff" : "#28a745"};">
                ${message.role === "user" ? "Bruger" : "Bot"}:
              </span>
              <span style="color: #555;">(${message.date})</span>
              <p style="background-color: #f1f1f1; padding: 10px; border-radius: 5px; border-left: 3px solid ${message.role === "user" ? "#007bff" : "#28a745"};">
                ${formatedMessage.replace(/\n/g, "<br>")}
              </p>
            </div>
          `;
            })
            .join("")}
        </div>
        
        <footer style="margin-top: 30px; font-size: 12px; color: #777;">
        </footer>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "Feedback received" });
  } catch (error) {
    console.error("Error processing feedback:", error);
    return NextResponse.json(
      { error: "An error occurred while processing feedback" },
      { status: 500 },
    );
  }
}

export const POST = handle;
