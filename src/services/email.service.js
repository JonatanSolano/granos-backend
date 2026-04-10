import nodemailer from "nodemailer";


// ======================================
// CONFIGURACIÓN TRANSPORTADOR
// ======================================

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }

});


// ======================================
// VERIFICAR CONEXIÓN
// ======================================

transporter.verify((error, success) => {

  if (error) {
    console.error("Error configuración correo:", error);
  } else {
    console.log("Servidor de correo listo");
  }

});


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
      `
    };

    await transporter.sendMail(mailOptions);

  } catch (error) {

    console.error("Error enviando MFA:", error);

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
      `
    };

    await transporter.sendMail(mailOptions);

  } catch (error) {

    console.error("Error enviando recuperación de usuario:", error);

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
      `
    };

    await transporter.sendMail(mailOptions);

  } catch (error) {

    console.error("Error enviando reset password:", error);

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
      `
    };

    await transporter.sendMail(mailOptions);

  } catch (error) {

    console.error("Error enviando confirmación password:", error);

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
      `
    };

    await transporter.sendMail(mailOptions);

  } catch (error) {

    console.error("Error enviando bloqueo cuenta:", error);

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
  sendAccountLockedNotification

};