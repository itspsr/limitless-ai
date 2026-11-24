"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
export default function Login() {
  const [register, R] = useState(false),
    [msg, M] = useState("");
  return (
    <form
      className="box login"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await signIn("credentials", {
          email: f.get("email"),
          password: f.get("password"),
          register: register ? "yes" : "no",
          redirect: false,
        });
        if (r?.error)
          M("Check your email and password or choose another email.");
        else location.reload();
      }}
    >
      <h2>{register ? "Create an account" : "Sign in"}</h2>
      <label>
        Email
        <input required name="email" type="email" autoComplete="email" />
      </label>
      <label>
        Password · 12 characters minimum
        <input
          required
          name="password"
          minLength={12}
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
        />
      </label>
      <div className="row">
        <button className="primary">
          {register ? "Create account" : "Sign in"}
        </button>
        <button type="button" onClick={() => R(!register)}>
          {register ? "Existing account" : "Register"}
        </button>
      </div>
      <p role="alert">{msg}</p>
    </form>
  );
}
