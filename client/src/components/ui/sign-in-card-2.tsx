import React, { useId, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Mail, Lock, Eye, EyeClosed, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

type FocusedInput = "email" | "password" | null;

export interface SignInCardProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  error?: React.ReactNode;
  logo?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  submitLabel?: string;
  emailPlaceholder?: string;
  passwordPlaceholder?: string;
  rememberMe?: { checked: boolean; onChange: (checked: boolean) => void; label?: string };
  forgotPassword?: { to: string; label?: string };
  /** Extra sign-in options (SSO…) rendered under an "ou" divider. */
  alternateActions?: React.ReactNode;
  /** Content rendered at the bottom of the card (sign-up link, demo accounts…). */
  footer?: React.ReactNode;
  /** Render the full-screen animated backdrop; disable when the page provides its own. */
  withBackground?: boolean;
  className?: string;
}

const BEAMS = [
  { className: "top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r", axis: "left", delay: 0 },
  { className: "top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b", axis: "top", delay: 0.6 },
  { className: "bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r", axis: "right", delay: 1.2 },
  { className: "bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b", axis: "bottom", delay: 1.8 },
] as const;

const CORNERS = [
  { className: "top-0 left-0 h-[5px] w-[5px] bg-gold-400/40 blur-[1px]", duration: 2, delay: 0 },
  { className: "top-0 right-0 h-[8px] w-[8px] bg-gold-400/60 blur-[2px]", duration: 2.4, delay: 0.5 },
  { className: "bottom-0 right-0 h-[8px] w-[8px] bg-gold-400/60 blur-[2px]", duration: 2.2, delay: 1 },
  { className: "bottom-0 left-0 h-[5px] w-[5px] bg-gold-400/40 blur-[1px]", duration: 2.3, delay: 1.5 },
];

function Backdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-espresso-800/60 via-espresso-900/80 to-espresso-950" />
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div className="absolute top-0 left-1/2 h-[60vh] w-[120vh] -translate-x-1/2 rounded-b-[50%] bg-gold-500/15 blur-[80px]" />
      <motion.div
        className="absolute top-0 left-1/2 h-[60vh] w-[100vh] -translate-x-1/2 rounded-b-full bg-gold-400/15 blur-[60px]"
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-[90vh] w-[90vh] -translate-x-1/2 rounded-t-full bg-brass/15 blur-[60px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />
    </>
  );
}

export function SignInCard({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  loading = false,
  error,
  logo,
  eyebrow,
  title = "Connexion",
  subtitle,
  submitLabel = "Se connecter",
  emailPlaceholder = "Adresse email",
  passwordPlaceholder = "Mot de passe",
  rememberMe,
  forgotPassword,
  alternateActions,
  footer,
  withBackground = true,
  className,
}: SignInCardProps) {
  const ids = useId();
  const reduceMotion = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<FocusedInput>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left - rect.width / 2);
    mouseY.set(event.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading) onSubmit();
  };

  const canSubmit = Boolean(email && password) && !loading;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className={cn("relative z-10 w-full max-w-[420px]", className)}
      style={{ perspective: 1500 }}
    >
      <motion.div className="relative" style={{ rotateX, rotateY }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} whileHover={reduceMotion ? undefined : { z: 10 }}>
        <div className="group relative">
          <motion.div
            className="absolute -inset-[1px] rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-70"
            animate={{
              boxShadow: ["0 0 10px 2px rgba(250,174,28,0.04)", "0 0 15px 5px rgba(250,174,28,0.08)", "0 0 10px 2px rgba(250,174,28,0.04)"],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
          />

          {!reduceMotion && (
            <div className="pointer-events-none absolute -inset-[1px] overflow-hidden rounded-2xl" aria-hidden="true">
              {BEAMS.map((beam) => (
                <motion.div
                  key={beam.axis}
                  className={cn("absolute from-transparent via-gold-400 to-transparent opacity-70", beam.className)}
                  initial={{ filter: "blur(2px)" }}
                  animate={{
                    [beam.axis]: ["-50%", "100%"],
                    opacity: [0.3, 0.7, 0.3],
                    filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                  }}
                  transition={{
                    [beam.axis]: { duration: 2.5, ease: "easeInOut" as const, repeat: Infinity, repeatDelay: 1, delay: beam.delay },
                    opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: beam.delay },
                    filter: { duration: 1.5, repeat: Infinity, repeatType: "mirror", delay: beam.delay },
                  }}
                />
              ))}
              {CORNERS.map((corner) => (
                <motion.div
                  key={corner.className}
                  className={cn("absolute rounded-full", corner.className)}
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: corner.duration, repeat: Infinity, repeatType: "mirror", delay: corner.delay }}
                />
              ))}
            </div>
          )}

          <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-white/[0.03] via-white/[0.07] to-white/[0.03] opacity-0 transition-opacity duration-500 group-hover:opacity-70" />

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-espresso-950/55 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                backgroundSize: "30px 30px",
              }}
            />

            <div className="relative mb-6 space-y-1.5 text-center">
              {logo && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="relative mx-auto mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gold-500/25"
                >
                  {logo}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                </motion.div>
              )}
              {eyebrow && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="text-[0.6875rem] font-bold tracking-[0.24em] text-brass uppercase">
                  {eyebrow}
                </motion.p>
              )}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-b from-white to-white/75 bg-clip-text font-display text-3xl font-medium text-transparent"
              >
                {title}
              </motion.h1>
              {subtitle && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-sm text-cream/65">
                  {subtitle}
                </motion.p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-4" noValidate>
              <div className="space-y-3">
                <motion.div
                  className={cn("relative", focusedInput === "email" && "z-10")}
                  whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <label htmlFor={`${ids}-email`} className="sr-only">
                    {emailPlaceholder}
                  </label>
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Mail className={cn("pointer-events-none absolute left-3 h-4 w-4 transition-all duration-300", focusedInput === "email" ? "text-gold-400" : "text-white/40")} />
                    <Input
                      id={`${ids}-email`}
                      type="email"
                      autoComplete="username"
                      placeholder={emailPlaceholder}
                      value={email}
                      onChange={(event) => onEmailChange(event.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      className="h-11 w-full border-transparent bg-white/5 pr-3 pl-10 text-white transition-all duration-300 placeholder:text-white/35 focus:border-gold-500/40 focus:bg-white/10"
                    />
                    {focusedInput === "email" && (
                      <motion.div layoutId="input-highlight" className="absolute inset-0 -z-10 bg-white/5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
                    )}
                  </div>
                </motion.div>

                <motion.div
                  className={cn("relative", focusedInput === "password" && "z-10")}
                  whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <label htmlFor={`${ids}-password`} className="sr-only">
                    {passwordPlaceholder}
                  </label>
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Lock className={cn("pointer-events-none absolute left-3 h-4 w-4 transition-all duration-300", focusedInput === "password" ? "text-gold-400" : "text-white/40")} />
                    <Input
                      id={`${ids}-password`}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder={passwordPlaceholder}
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      className="h-11 w-full border-transparent bg-white/5 pr-11 pl-10 text-white transition-all duration-300 placeholder:text-white/35 focus:border-gold-500/40 focus:bg-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-white/40 transition-colors duration-300 hover:text-white focus-visible:ring-2 focus-visible:ring-gold-500/60 focus-visible:outline-none"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
                    </button>
                    {focusedInput === "password" && (
                      <motion.div layoutId="input-highlight" className="absolute inset-0 -z-10 bg-white/5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
                    )}
                  </div>
                </motion.div>
              </div>

              {(rememberMe || forgotPassword) && (
                <div className="flex items-center justify-between pt-1">
                  {rememberMe ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          id={`${ids}-remember`}
                          type="checkbox"
                          checked={rememberMe.checked}
                          onChange={(event) => rememberMe.onChange(event.target.checked)}
                          className="h-4 w-4 appearance-none rounded border border-white/20 bg-white/5 transition-all duration-200 checked:border-gold-500 checked:bg-gold-500 focus:ring-1 focus:ring-gold-500/40 focus:outline-none"
                        />
                        {rememberMe.checked && (
                          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-none absolute inset-0 flex items-center justify-center text-espresso-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.div>
                        )}
                      </div>
                      <label htmlFor={`${ids}-remember`} className="text-xs text-white/60 transition-colors duration-200 hover:text-white/80">
                        {rememberMe.label ?? "Se souvenir de moi"}
                      </label>
                    </div>
                  ) : (
                    <span />
                  )}
                  {forgotPassword && (
                    <Link to={forgotPassword.to} className="text-xs text-white/60 transition-colors duration-200 hover:text-white">
                      {forgotPassword.label ?? "Mot de passe oublié ?"}
                    </Link>
                  )}
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-100"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={canSubmit && !reduceMotion ? { scale: 1.02 } : undefined}
                whileTap={canSubmit ? { scale: 0.98 } : undefined}
                type="submit"
                disabled={!canSubmit}
                aria-busy={loading}
                className="group/button relative mt-5 w-full rounded-lg border-0 bg-transparent p-0 focus-visible:ring-[3px] focus-visible:ring-gold-500/50 focus-visible:outline-none disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 rounded-lg bg-gold-500/25 opacity-0 blur-lg transition-opacity duration-300 group-hover/button:opacity-70" />
                <div
                  className={cn(
                    "relative flex h-11 items-center justify-center overflow-hidden rounded-lg font-semibold transition-all duration-300",
                    canSubmit || loading ? "bg-gold-500 text-espresso-900 group-hover/button:bg-gold-400" : "bg-gold-500/35 text-espresso-900/70",
                  )}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                    style={{ opacity: loading ? 1 : 0, transition: "opacity 0.3s ease" }}
                  />
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-espresso-900/70 border-t-transparent" />
                      </motion.div>
                    ) : (
                      <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center justify-center gap-1.5 text-sm">
                        {submitLabel}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/button:translate-x-1" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>

              {alternateActions && (
                <>
                  <div className="relative mt-2 mb-5 flex items-center">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="mx-3 text-xs text-white/40">ou</span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>
                  {alternateActions}
                </>
              )}
            </form>

            {footer && <div className="relative mt-6">{footer}</div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  if (!withBackground) return card;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-espresso-950 px-4">
      <Backdrop />
      {card}
    </div>
  );
}

export { SignInCard as Component };
