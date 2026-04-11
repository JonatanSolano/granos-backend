import nodemailer from "nodemailer";

// ======================================
// FLAGS
// ======================================

const isRender =
  !!process.env.RENDER ||
  !!process.env.RENDER_EXTERNAL_URL ||
  !!process.env.RENDER_SERVICE_ID;

const emailTransportEnabled =
  process.env.EMAIL_TRANSPORT_ENABLED === "true" &&
  !!process.env.EMAIL_USER &&
  !!process.env.EMAIL_PASS;

// ======================================
// CONFIGURACIÓN TRANSPORTADOR
// ======================================

let transporter = null;

if (emailTransportEnabled) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  transporter.verify((error) => {
    if (error) {
      console.error("Error configuración correo:", error.message);
    } else {
      console.log("Servidor de correo listo");
    }
  });
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
  if (!emailTransportEnabled || !transporter) {
    console.log(
      `[EMAIL SIMULADO] ${simulationLabel} -> ${mailOptions.to} | asunto: ${mailOptions.subject}`
    );

    return {
      sent: false,
      simulated: true,
    };
  }

  await transporter.sendMail(mailOptions);

  return {
    sent: true,
    simulated: false,
  };
};

// ======================================
// ENVIAR CÓDIGO MFA
// ======================================

const sendMFACode = async (email, code) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_USER}>`,
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
    };
  }
};

// ======================================
// RECUPERAR USERNAME
// ======================================

const sendUsernameRecovery = async (email, username) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_USER}>`,
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
    };

    return await sendMailOrSimulate(mailOptions, `USERNAME ${username}`);
  } catch (error) {
    console.error("Error enviando recuperación de usuario:", error.message);

    return {
      sent: false,
      simulated: true,
    };
  }
};

// ======================================
// RECUPERACIÓN PASSWORD
// ======================================

const sendPasswordReset = async (email, token) => {
  try {
    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_USER}>`,
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
           ">
           Restablecer contraseña
        </a>

        <p>Este enlace expira en <b>15 minutos</b>.</p>

        <hr>

        <small>
        Si usted no solicitó este cambio ignore este correo.
        </small>
      `,
    };

    return await sendMailOrSimulate(mailOptions, `RESET ${token}`);
  } catch (error) {
    console.error("Error enviando reset password:", error.message);

    return {
      sent: false,
      simulated: true,
    };
  }
};

// ======================================
// CONFIRMAR CAMBIO PASSWORD
// ======================================

const sendPasswordChangedNotification = async (email) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Contraseña cambiada",
      html: `
        <h2>Contraseña actualizada</h2>

        <p>Su contraseña fue cambiada correctamente.</p>

        <p>Si usted no realizó este cambio contacte inmediatamente con soporte.</p>
      `,
    };

    return await sendMailOrSimulate(mailOptions, "PASSWORD_CHANGED");
  } catch (error) {
    console.error("Error enviando confirmación password:", error.message);

    return {
      sent: false,
      simulated: true,
    };
  }
};

// ======================================
// CUENTA BLOQUEADA
// ======================================

const sendAccountLockedNotification = async (email) => {
  try {
    const mailOptions = {
      from: `"Granos La Tradición" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Cuenta bloqueada temporalmente",
      html: `
        <h2>Cuenta bloqueada</h2>

        <p>Su cuenta ha sido bloqueada temporalmente debido a múltiples intentos fallidos de inicio de sesión.</p>

        <p>Intente nuevamente en unos minutos o utilice la recuperación de contraseña.</p>
      `,
    };

    return await sendMailOrSimulate(mailOptions, "ACCOUNT_LOCKED");
  } catch (error) {
    console.error("Error enviando bloqueo cuenta:", error.message);

    return {
      sent: false,
      simulated: true,
    };
  }
};

// ======================================
// EXPORTS
// ======================================

export default {
  sendMFACode,
  sendUsernameRecovery,
  sendPasswordReset,
  sendPasswordChangedNotification,
  sendAccountLockedNotification,
};