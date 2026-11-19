"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Sprout, Loader2, Leaf, Wheat,
  ArrowRight, Shield, Mic, BarChart3, CloudSun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/contexts/language-context";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().min(1, "Email / username is required"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: Mic,       label: "AI Voice Assistant in 8 languages" },
  { icon: Leaf,      label: "Soil & Crop Disease Diagnosis" },
  { icon: BarChart3, label: "Live Mandi Prices & Market Trends" },
  { icon: CloudSun,  label: "Hyperlocal Weather & Spray Advisory" },
  { icon: Shield,    label: "Government Schemes Navigator" },
  { icon: Wheat,     label: "Crop Recommender with Yield Forecast" },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup";

  const { signInWithEmail, signUpWithEmail, signInAsDemoFarmer } = useAuth();
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "demo", password: "demo" },
  });

  // If already logged in, redirect
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (isSignUp) {
        await signUpWithEmail(data.email, data.password);
        toast({ title: "Account Created!", description: "Please sign in to continue." });
        setIsSignUp(false);
        reset({ email: data.email, password: "" });
      } else {
        await signInWithEmail(data.email, data.password);
        toast({ title: "Welcome back! 🌾", description: "Loading your Krishi dashboard..." });
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast({
        title: isSignUp ? "Sign Up Failed" : "Sign In Failed",
        description: err?.message || "Invalid credentials. Try demo / demo.",
        variant: "destructive",
      });
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await signInAsDemoFarmer();
      toast({ title: "Demo Login Successful 🌾", description: "Welcome, Kisan Bhai!" });
      router.push("/dashboard");
    } catch (err: any) {
      toast({ title: "Demo failed", description: err?.message, variant: "destructive" });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F7EFD9]">

      {/* ── LEFT PANEL — Branding (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1A4A28] flex-col justify-between p-12 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#245B35] opacity-50" />
        <div className="absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-[#C99A3A]/20" />
        <div className="absolute top-1/2 right-0 w-40 h-40 rounded-full bg-[#C99A3A]/10" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-[#C99A3A] flex items-center justify-center shadow-lg">
              <Sprout className="h-6 w-6 text-[#1A4A28]" />
            </div>
            <div>
              <span className="text-2xl font-black text-[#FAF5E8] tracking-tight">Krishi Mitra</span>
              <p className="text-[10px] text-[#A7F3D0] font-semibold uppercase tracking-widest">किसान का स्मार्ट साथी</p>
            </div>
          </Link>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-black text-[#FAF5E8] leading-tight mb-3">
              India&apos;s Smartest<br />
              <span className="text-[#C99A3A]">Farmer OS</span>
            </h1>
            <p className="text-[#A7F3D0] text-sm leading-relaxed max-w-sm">
              150 million farmers deserve expert guidance in their own language. 
              Krishi Mitra brings AI, voice, and real data to every field.
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#245B35] flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-[#A7F3D0]" />
                </div>
                <span className="text-sm text-[#FAF5E8] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10">
          <blockquote className="border-l-2 border-[#C99A3A] pl-4">
            <p className="text-[#FAF5E8]/80 text-sm italic leading-relaxed">
              &quot;जब किसान समृद्ध होगा, तभी देश समृद्ध होगा।&quot;
            </p>
            <footer className="text-[#C99A3A] text-xs font-semibold mt-1">
              — When the farmer prospers, the nation prospers.
            </footer>
          </blockquote>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1A4A28] flex items-center justify-center">
            <Sprout className="h-5 w-5 text-[#FAF5E8]" />
          </div>
          <span className="text-xl font-black text-[#281E15]">Krishi Mitra</span>
        </div>

        <div className="w-full max-w-md space-y-6">

          {/* Heading */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[#281E15]">
              {isSignUp ? "Create Account" : "Welcome Back 👋"}
            </h2>
            <p className="text-sm text-[#5D4A3A]">
              {isSignUp
                ? "Sign up to access your Krishi dashboard"
                : "Sign in to continue to your farm dashboard"}
            </p>
          </div>

          {/* Demo login card */}
          <div className="bg-gradient-to-br from-[#EAF4EC] to-[#F0F9F2] border-2 border-[#245B35]/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#245B35] bg-[#D4EAD9] px-2.5 py-1 rounded-lg">
                🌾 1-Click Demo Mode
              </span>
              <span className="text-xs text-[#5D4A3A] font-medium">Karnal, Haryana</span>
            </div>
            <p className="text-xs text-[#3F2918] leading-relaxed">
              Instant access with pre-loaded farm data, crop records, mandi history & mock transactions.
            </p>
            <Button
              type="button"
              onClick={handleDemo}
              disabled={demoLoading}
              className="w-full bg-[#245B35] hover:bg-[#1A4A28] text-[#FAF5E8] font-bold rounded-xl py-5 shadow border border-[#194A28] flex items-center justify-center gap-2 cursor-pointer"
            >
              {demoLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sprout className="h-4 w-4" />}
              <span>Enter as Demo Farmer (Kisan Bhai)</span>
              {!demoLoading && <ArrowRight className="h-4 w-4 ml-auto" />}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#D8CABA]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#F7EFD9] px-3 text-xs text-[#756653] font-semibold uppercase tracking-wider">
                or sign in with credentials
              </span>
            </div>
          </div>

          {/* Credentials hint */}
          <div className="bg-[#FFFBF0] border border-[#D8CABA] rounded-xl px-4 py-2.5 text-center">
            <p className="text-xs text-[#5D4A3A]">
              🔑 Demo credentials: <strong className="text-[#245B35]">demo</strong> / <strong className="text-[#245B35]">demo</strong>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold text-[#281E15]">
                {t("login.emailLabel") || "Email / Username"}
              </Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="demo"
                {...register("email")}
                className="bg-white border-[#D8CABA] text-[#281E15] placeholder:text-[#B0A090] rounded-xl h-11 focus-visible:ring-[#245B35] focus-visible:border-[#245B35]"
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-bold text-[#281E15]">
                {t("login.passwordLabel") || "Password"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="demo"
                  {...register("password")}
                  className="bg-white border-[#D8CABA] text-[#281E15] placeholder:text-[#B0A090] rounded-xl h-11 pr-10 focus-visible:ring-[#245B35] focus-visible:border-[#245B35]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7A68] hover:text-[#281E15] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#1A4A28] hover:bg-[#122F1A] active:scale-[0.98] text-[#FAF5E8] font-bold py-6 rounded-xl shadow-md border border-[#122F1A] text-sm transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("login.processing") || "Please wait..."}
                </span>
              ) : isSignUp ? (
                <span className="flex items-center gap-2">
                  {t("login.createAccountButton") || "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("login.signInButton") || "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Toggle sign in / sign up */}
          <p className="text-center text-sm text-[#5D4A3A]">
            {isSignUp ? (
              <>
                {t("login.alreadyHaveAccount") || "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); reset(); }}
                  className="text-[#245B35] font-bold hover:underline cursor-pointer"
                >
                  {t("login.signInLink") || "Sign In"}
                </button>
              </>
            ) : (
              <>
                {t("login.dontHaveAccount") || "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); reset(); }}
                  className="text-[#245B35] font-bold hover:underline cursor-pointer"
                >
                  {t("login.signUpLink") || "Sign Up"}
                </button>
              </>
            )}
          </p>

          {/* Back to home */}
          <div className="text-center">
            <Link
              href="/"
              className="text-xs text-[#8C7A68] hover:text-[#245B35] font-medium transition-colors inline-flex items-center gap-1"
            >
              ← Back to home
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F7EFD9]">
        <Loader2 className="h-8 w-8 animate-spin text-[#245B35]" />
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
