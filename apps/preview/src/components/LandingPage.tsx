import {
  ChevronRight,
  Github,
  Menu,
  Rocket,
  Shield,
  Twitter,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Rocket className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Scratchpad
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Features
            </a>
            <a
              href="#"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Company
            </a>
            <a
              href="#"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Blog
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Log in
            </button>
            <button className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-slate-200">
              Get Started
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-6">
            <div className="flex flex-col space-y-4">
              <a href="#" className="text-base font-medium text-slate-600">
                Features
              </a>
              <a href="#" className="text-base font-medium text-slate-600">
                Pricing
              </a>
              <a href="#" className="text-base font-medium text-slate-600">
                Company
              </a>
              <hr className="border-slate-100" />
              <button className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-900">
                Log in
              </button>
              <button className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white">
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 md:pt-24 lg:pt-32 pb-16">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 mr-2"></span>
              v2.0 is now live
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
              Launch tonight
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Skip the config. We handle auth, database, and payments so you can
              just build.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 hover:-translate-y-0.5">
                Start Building Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
              <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300">
                View Documentation
              </button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-12 grayscale opacity-70">
              {/* Google */}
              <svg
                className="h-8 w-auto text-slate-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21.35 11.1h-9.17v2.98h7.19c-.94 5.29-6.9 5.4-8.19 2.67-1.71-3.6 2.05-6.32 4.09-5.18l2.25-2.26c-2.73-2.28-7.97-1.62-9.98 1.48-2.6 4.01-1.24 9.19 3.4 11.15 4.88 2.06 10.15-1.4 10.42-6.57v-1.73z" />
              </svg>

              {/* Stripe */}
              <svg
                className="h-8 w-auto text-slate-500"
                viewBox="0 0 60 25"
                fill="currentColor"
              >
                <path d="M59.64 10.28c0-4.6-3.8-8.22-9.3-8.22-6.5 0-9.82 4.14-9.82 4.14l1.83 3.03s2.96-3.1 7.27-3.1c1.94 0 3.2.78 3.2 2.3v.35c-7.96.22-11.77 2.37-11.77 6.43 0 3.12 2.5 5.3 6.07 5.3 4.34 0 6.64-2.45 6.64-2.45v1.9h4.08V10.28h-1.2zm-4.7 6.3s-.9 1.73-3.18 1.73c-1.37 0-2.3-.7-2.3-1.85 0-2.35 3.55-3.05 6.35-3.12v3.25h-.86zM32.54 6.78V2.5h-4.2v4.28h-2.73v3.4h2.73v7.35c0 3.5 2.5 5 5.95 4.5v-3.32c-1.15.13-1.92-.27-1.92-1.55v-7h4.84v-3.4h-4.68zM22.95 7.15c0-1.5 1.2-2.72 2.7-2.72 1.47 0 2.68 1.2 2.68 2.7 0 1.52-1.2 2.73-2.68 2.73-1.5 0-2.7-1.2-2.7-2.72zm.5 12.83h4.4V6.78h-4.4v13.2zm-4.14-4.8c-.85.73-1.95 1.15-3.2 1.15-3.06 0-4.64-1.98-4.64-5.22 0-3.33 1.5-5.3 4.63-5.3 1.23 0 2.22.38 3.08 1.05V2.5h4.4v17.48h-4.28v-1.9zm-3.23-6.2c-1.28 0-1.9.96-1.9 2.2 0 1.24.6 2.23 1.9 2.23.95 0 1.83-.55 2.38-1.5V10.4c-.6-.94-1.42-1.42-2.38-1.42zM4.13 20h4.3V6.78h-4.3V20zm0-15.65h4.3V2.46h-4.3v1.9z" />
              </svg>

              {/* Cursor */}
              <svg
                className="h-7 w-auto text-slate-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2.9-3.2-7.4-4.4 4.6V2z" />
              </svg>

              {/* OpenAI */}
              <svg
                className="h-8 w-auto text-slate-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.28 9.28a6.38 6.38 0 0 0-.23-3.61 6.13 6.13 0 0 0-3.86-3.86 6.38 6.38 0 0 0-3.64.22 6.16 6.16 0 0 0-2.65-1.9A6.38 6.38 0 0 0 8.3.36a6.13 6.13 0 0 0-4.6 1.8 6.38 6.38 0 0 0-3.86.23 6.13 6.13 0 0 0-1.9 2.65 6.38 6.38 0 0 0 .23 3.64A6.13 6.13 0 0 0 2 12.54a6.38 6.38 0 0 0 3.64-.22 6.16 6.16 0 0 0 2.65 1.9 6.38 6.38 0 0 0 3.61-.23 6.13 6.13 0 0 0 4.6-1.8 6.38 6.38 0 0 0 3.86-.23 6.13 6.13 0 0 0 1.9-2.65zm-9.5 8.54l-3.3-1.9 1.17-2.02 3.3 1.9 1.9-1.1-1.16-2.02-1.9 1.1-1.9-3.3 2.02-1.17 1.9 3.3 3.3-1.9-1.17 2.02-3.3-1.9-1.9 1.1 1.16 2.02 1.9-1.1 1.9 3.3-2.02 1.17-1.9-3.3zM8 12.01c0 2.2 1.8 4 4 4s4-1.8 4-4-1.8-4-4-4-4 1.8-4 4z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Background Gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-white to-white pointer-events-none"></div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Everything you need
            </h2>
            <p className="mt-6 text-xl text-slate-600 leading-relaxed">
              We've handled the boring stuff so you can focus on building your
              product.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="group bg-white p-10 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Lightning Fast
              </h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                Optimized for speed out of the box. We use the latest tech stack
                to ensure your app loads instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white p-10 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 rounded-xl bg-green-50 flex items-center justify-center text-green-600 mb-8 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Secure by Design
              </h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                Enterprise-grade security features included. Authentication,
                authorization, and data encryption ready.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white p-10 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 hover:-translate-y-1">
              <div className="h-14 w-14 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-8 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                <Github className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Open Source
              </h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                Built on open standards. No lock-in. You own your code and your
                data, forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-slate-900">LaunchPad</span>
          </div>

          <div className="text-sm text-slate-500">
            © 2024 LaunchPad Inc. All rights reserved.
          </div>

          <div className="flex gap-4">
            <a
              href="#"
              className="text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
