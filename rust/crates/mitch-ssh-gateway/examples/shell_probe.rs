//! Minimal russh shell probe: connect to a real sshd, request a shell, run
//! `echo`, print every ChannelMsg that arrives. Isolates the SSH layer from
//! the WS layer.
//!
//! Usage: cargo run -p mitch-ssh-gateway --example shell_probe -- <host> <port> <user> <pass>
//!
//! Debug tool: expect()-based error handling is intentional here.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::sync::Arc;

struct AcceptAll;

impl russh::client::Handler for AcceptAll {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        _k: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

#[tokio::main]
async fn main() {
    let (host, port, user, pass) = {
        let mut a = std::env::args().skip(1);
        let host = a.next().expect("host");
        let port: u16 = a.next().expect("port").parse().expect("port num");
        let user = a.next().expect("user");
        let pass = a.next().expect("pass");
        (host, port, user, pass)
    };

    let mut session = russh::client::connect(
        Arc::new(russh::client::Config::default()),
        (host.as_str(), port),
        AcceptAll,
    )
    .await
    .expect("connect");
    let auth = session
        .authenticate_password(user, pass)
        .await
        .expect("auth");
    println!("auth ok: {}", auth.success());

    let mut channel = session.channel_open_session().await.expect("channel");
    channel
        .request_pty(true, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .expect("pty");
    channel.request_shell(true).await.expect("shell");
    println!("shell open; waiting for output…");

    channel
        .data(&b"echo PROBE_ECHO_OK\n"[..])
        .await
        .expect("data");

    for i in 0..20 {
        match channel.wait().await {
            Some(msg) => println!("[{i}] {msg:?}"),
            None => {
                println!("[{i}] wait() returned None — channel closed");
                break;
            }
        }
        if i > 15 {
            break;
        }
    }
    let _ = session
        .disconnect(russh::Disconnect::ByApplication, "probe done", "en")
        .await;
}
