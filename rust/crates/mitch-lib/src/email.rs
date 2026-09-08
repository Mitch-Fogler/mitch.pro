//! Shared email template + delivery helpers used by mitch-mail (plan Step 2).
//!
//! Contract (from `mail/send_email.js`, `mail/noreply_send.js`,
//! `mail/support_send.js`): three near-identical nodemailer CLIs — branded HTML
//! template, unsubscribe-token footer, SMTP :465 via Hostinger
//! `mail.mitch.pro`, sender selected by recipient domain
//! (`GMAIL_USER` for student.rjuhsd.us, `NOREPLY_USER` for @mitch.pro,
//! `support@` alias).
//!
//! Status: scaffold stub — implemented in plan Step 2.

#![allow(dead_code)]

/// Email sender, not yet wired.
pub struct EmailSender;

impl EmailSender {
    /// Placeholder so the module compiles; replaced in Step 2.
    pub fn placeholder() -> Self {
        Self
    }
}
