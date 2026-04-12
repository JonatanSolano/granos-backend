import { Resend } from "resend";

// ======================================
// FLAGS
// ======================================

const isRender =
  !!process.env.RENDER ||
  !!process.env.RENDER_EXTERNAL_URL ||
  !!process.env.RENDER_SERVICE_ID;

const emailTransportEnabled =
  process.env.EMAIL_TRANSPORT_ENABLED === "true" &&
  !!process.env.RESEND_API_KEY &&
  !!process.env.EMAIL_FROM;

const resend = emailTransportEnabled
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (emailTransportEnabled) {
  console.log("Servicio de correo por Resend activado");
} else {
  console.log(
    isRender
      ? "Servicio de correo desactivado en Render. Se usará modo simulado."
      : "Servicio de correo desactivado. Se usará modo simulado."
  );
}

// ======================================
// HELPER ENVÍO
// ======================================

const sendMailOrSimulate = async (mailOptions, simulationLabel = "correo") => {
  if (!emailTransportEnabled || !resend) {
    console.log(
      `[EMAIL SIMULADO] ${simulationLabel} -> ${mailOptions.to} | asunto: ${mailOptions.subject}`
    );

    return {
      sent: false,
      simulated: true,
      reason: "transport_disabled",
    };
  }

  try {
    console.log(
      `[EMAIL REAL] Intentando envío -> ${mailOptions.to} | asunto: ${mailOptions.subject}`
    );

    const response = await resend.emails.send({
      from: mailOptions.from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    });

    console.log("[RESEND RESPONSE]", JSON.stringify(response));

    if (response?.error) {
      console.error("[RESEND ERROR DETECTADO]", response.error);

      return {
        sent: false,
        simulated: true,
        error: response.error,
        reason: "resend_error",
      };
    }

    console.log(
      `[EMAIL REAL ENVIADO] ${mailOptions.to} | id: ${response?.data?.id ?? "sin-id"}`
    );

    return {
      sent: true,
      simulated: false,
      id: response?.data?.id ?? null,
    };
  } catch (error) {
    console.error("[RESEND EXCEPTION]", error?.message || error);
    console.error("[RESEND EXCEPTION FULL]", error);

    return {
      sent: false,
      simulated: true,
      error: error?.message || String(error),
      reason: "exception",
    };
  }
};

// ======================================
// ENVIAR CÓDIGO MFA
// ======================================

const sendMFACode = async (email, code) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Código de verificación MFA",
      html: `
        <h2>Verificación de Seguridad</h2>
        <p>Su código de verificación es:</p>
        <h1 style="
          letter-spacing:4px;
          color:#2E7D32;
          font-size:40px;
        ">
          ${code}
        </h1>
        <p>Este código expira en <b>5 minutos</b>.</p>
        <hr>
        <small>
        Si usted no solicitó este acceso, ignore este mensaje.
        </small>
      `,
      text: `Su código de verificación MFA es: ${code}. Expira en 5 minutos.`,
    };

    const result = await sendMailOrSimulate(mailOptions, `MFA ${code}`);

    if (result.simulated) {
      console.log(`[MFA SIMULADO] ${email} -> ${code}`);
    }

    return result;
  } catch (error) {
    console.error("Error enviando MFA:", error.message);

    console.log(`[MFA SIMULADO POR FALLA] ${email} -> ${code}`);

    return {
      sent: false,
      simulated: true,
      reason: "outer_exception",
    };
  }
};

// ======================================
// RECUPERAR USERNAME
// ======================================

const sendUsernameRecovery = async (email, username) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Recuperación de Usuario",
      html: `
        <h2>Recuperación de Usuario</h2>
        <p>Su nombre de usuario es:</p>
        <h1 style="
          color:#2E7D32;
          font-size:32px;
        ">
          ${username}
        </h1>
        <p>Puede utilizar este usuario para iniciar sesión en el sistema.</p>
        <hr>
        <small>
        Si usted no solicitó esta recuperación, ignore este mensaje.
        </small>
      `,
      text: `Su nombre de usuario es: ${username}`,
    };

    return await sendMailOrSimulate(mailOptions, `USERNAME ${username}`);
  } catch (error) {
    console.error("Error enviando recuperación de usuario:", error.message);

    return {
      sent: false,
      simulated: true,
      reason: "outer_exception",
    };
  }
};

// ======================================
// RECUPERACIÓN PASSWORD
// ======================================

const sendPasswordReset = async (email, token) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Recuperación de contraseña",
      html: `
        <h2>Recuperación de contraseña</h2>
        <p>Se ha solicitado restablecer su contraseña.</p>
        <p>Haga clic en el siguiente enlace:</p>
        <a href="${resetLink}" 
           style="
             background:#2E7D32;
             color:white;
             padding:12px 20px;
             text-decoration:none;
             border-radius:5px;
             display:inline-block;
           ">
           Restablecer contraseña
        </a>
        <p>Este enlace expira en <b>15 minutos</b>.</p>
        <hr>
        <small>
        Si usted no solicitó este cambio ignore este correo.
        </small>
      `,
      text: `Restablezca su contraseña aquí: ${resetLink}`,
    };

    return await sendMailOrSimulate(mailOptions, `RESET ${token}`);
  } catch (error) {
    console.error("Error enviando reset password:", error.message);

    return {
      sent: false,
      simulated: true,
      reason: "outer_exception",
    };
  }
};

// ======================================
// CONFIRMAR CAMBIO PASSWORD
// ======================================

const sendPasswordChangedNotification = async (email) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Contraseña cambiada",
      html: `
        <h2>Contraseña actualizada</h2>
        <p>Su contraseña fue cambiada correctamente.</p>
        <p>Si usted no realizó este cambio contacte inmediatamente con soporte.</p>
      `,
      text: "Su contraseña fue cambiada correctamente. Si usted no realizó este cambio contacte soporte.",
    };

    return await sendMailOrSimulate(mailOptions, "PASSWORD_CHANGED");
  } catch (error) {
    console.error("Error enviando confirmación password:", error.message);

    return {
      sent: false,
      simulated: true,
      reason: "outer_exception",
    };
  }
};

// ======================================
// CUENTA BLOQUEADA
// ======================================

const sendAccountLockedNotification = async (email) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Cuenta bloqueada temporalmente",
      html: `
        <h2>Cuenta bloqueada</h2>
        <p>Su cuenta ha sido bloqueada temporalmente debido a múltiples intentos fallidos de inicio de sesión.</p>
        <p>Intente nuevamente en unos minutos o utilice la recuperación de contraseña.</p>
      `,
      text: "Su cuenta ha sido bloqueada temporalmente por múltiples intentos fallidos.",
    };

    return await sendMailOrSimulate(mailOptions, "ACCOUNT_LOCKED");
  } catch (error) {
    console.error("Error enviando bloqueo cuenta:", error.message);

    return {
      sent: false,
      simulated: true,
      reason: "outer_exception",
    };
  }
};

export default {
  sendMFACode,
  sendUsernameRecovery,
  sendPasswordReset,
  sendPasswordChangedNotification,
  sendAccountLockedNotification,
};