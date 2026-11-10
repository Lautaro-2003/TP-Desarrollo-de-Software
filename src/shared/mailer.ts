import nodemailer from "nodemailer"

// sin SMTP_URL (desarrollo y tests) no sale ningún mail: el link se muestra en la consola del servidor
const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null
const from = process.env.MAIL_FROM ?? "Tienda <no-reply@tienda.local>"
const appUrl = process.env.APP_URL ?? "http://localhost:5173"

export async function sendConfirmationEmail(to: string, name: string, token: string) {
  const link = `${appUrl}/confirmar/${token}`
  if (!transport) {
    console.log(`Mail de confirmación para ${to}: ${link}`)
    return
  }
  await transport.sendMail({
    from,
    to,
    subject: "Confirmá tu email",
    text: `Hola ${name}, para activar tu cuenta entrá a este link: ${link}`,
    // el nombre lo escribe el usuario: se escapa para que no meta HTML en el mail
    html: `<p>Hola ${name.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)},</p><p>Para activar tu cuenta hacé clic en el link:</p><p><a href="${link}">Confirmar mi email</a></p>`,
  })
}
