import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)");
  }

  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendOrderConfirmationEmail(order, orderId) {
  if (!order?.contact?.email) return;
  const to = String(order.contact.email).trim();
  const name = order.contact.name ? String(order.contact.name).trim() : "Customer";
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const transport = getTransport();

  const subject = `Your ${process.env.STORE_NAME || "Order"} is confirmed — ${orderId}`;
  const orderUrl = (process.env.SITE_ORIGIN || "") + `/order/${encodeURIComponent(orderId)}`;
  const text = `Hi ${name},\n\nThank you — your order ${orderId} has been confirmed. You can check the status at ${orderUrl}\n\nAmount: ₹${(Number(order.amount)||0)/100}\n\nIf you have questions, reply to this email or message us on WhatsApp.\n\nThanks!`;

  const html = `<p>Hi ${name},</p>
    <p>Thank you — your order <strong>${orderId}</strong> has been confirmed.</p>
    <p>Amount: <strong>₹${(Number(order.amount)||0)/100}</strong></p>
    <p>You can check the status of your order <a href="${orderUrl}">here</a>.</p>
    <p>Thanks,<br/>${process.env.STORE_NAME || "Store"}</p>`;

  await transport.sendMail({ from, to, subject, text, html });
}
