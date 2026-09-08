import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Compass,
  Eye,
  Globe,
  LineChart,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TITLE = "Merchant Core — digital presence infrastructure for local businesses";
const DESCRIPTION =
  "Merchant Core keeps your business information canonical, publishes a maintained public web page from it, and prepares you for search, AI discovery, and direct commerce.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-businesses", label: "For businesses" },
];

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: Store,
    title: "One canonical business record",
    body: "Name, categories, locations, hours, contact details, services, products, and offers live in a single structured record instead of scattered across tools.",
  },
  {
    icon: Globe,
    title: "A public page built from that record",
    body: "Your public business page is generated from your data and republished whenever the data changes — no rebuild project, no agency ticket.",
  },
  {
    icon: Compass,
    title: "Discovery and onboarding",
    body: "Businesses are sourced from public business directories with the original source, external identifier, and retrieval time kept as evidence.",
  },
  {
    icon: Eye,
    title: "Visibility tracking",
    body: "Track how your business is represented across search and AI answer surfaces, so gaps in your information become visible instead of invisible.",
  },
  {
    icon: RefreshCw,
    title: "Continuous updates",
    body: "New observations about your business are collected over time and surfaced as changes to review — nothing is silently overwritten.",
  },
  {
    icon: ShoppingCart,
    title: "Commerce readiness",
    body: "Structured catalog, offers, orders, and subscriptions give you the foundation for direct selling and future agent-assisted purchasing.",
  },
];

const STEPS = [
  {
    title: "Claim your business",
    body: "We create or match your canonical record, including locations and opening hours, and link it to your account.",
  },
  {
    title: "Complete your information",
    body: "In the store portal you maintain details, locations, services, products, offers, and announcements yourself.",
  },
  {
    title: "Publish your page",
    body: "A public page is generated from your record and published at a stable address you can share anywhere.",
  },
  {
    title: "Keep improving",
    body: "Updates, new observations, and visibility checks keep the record accurate and your presence current.",
  },
];

const BENEFITS = [
  "Update once — your public page and structured data follow.",
  "Every fact keeps its source, so you can see where information came from.",
  "Announcements, events, and offers are published as structured content.",
  "Multiple locations and opening hours are first-class, not free text.",
  "Your workspace data is isolated per business at the database level.",
  "An append-only history records every meaningful change.",
];

const PROOF = [
  {
    icon: ShieldCheck,
    title: "Tenant isolation enforced in the database",
    body: "Access is scoped per workspace with row-level security, not filtered in the browser.",
  },
  {
    icon: BadgeCheck,
    title: "Evidence-backed data",
    body: "Source records, observations, and provenance are stored alongside every normalized fact.",
  },
  {
    icon: LineChart,
    title: "Auditable operations",
    body: "Discovery runs, publishes, refreshes, and edits are recorded as append-only business events.",
  },
  {
    icon: Boxes,
    title: "Truthful integration status",
    body: "External providers report configured or not-configured states — results are never simulated.",
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold">Merchant Core</span>
            <span className="text-xs text-muted-foreground">Business presence platform</span>
          </div>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#get-started">Get started</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </div>
            <span className="text-sm font-semibold">Merchant Core</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Canonical business data, a maintained public page, and commerce-ready structure for
            local businesses.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Product</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#product" className="hover:text-foreground">
                Overview
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="hover:text-foreground">
                How it works
              </a>
            </li>
            <li>
              <a href="#for-businesses" className="hover:text-foreground">
                For businesses
              </a>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Access</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/signin" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/portal" className="hover:text-foreground">
                Store portal
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-foreground">
                Operator console
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Get started</p>
          <p className="text-sm text-muted-foreground">
            Businesses join by invitation from an operator workspace while we are in development.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href="#get-started">Request access</a>
          </Button>
        </div>
      </div>
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Merchant Core</span>
        <span>Built as a multi-tenant merchant operations platform.</span>
      </div>
    </footer>
  );
}

function HomePage() {
  return (
    <div className="min-h-svh bg-background">
      <Header />

      <main>
        <section className="border-b bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <div className="space-y-6">
              <Badge variant="secondary" className="rounded-full">
                Digital presence infrastructure
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Your business, correctly represented everywhere it matters.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Merchant Core turns your business information into one canonical record, publishes a
                maintained public page from it, and keeps it current for search, AI discovery, and
                direct commerce.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="#get-started">
                    Get started
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Already set up?{" "}
                <Link to="/signin" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to your store portal or operator console.
              </p>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">What a maintained record covers</CardTitle>
                <CardDescription>
                  The same structure powers your public page, your search presence, and your
                  commerce setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  "Identity & categories",
                  "Locations & hours",
                  "Services & products",
                  "Offers & promotions",
                  "Announcements & events",
                  "Contact & web links",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Presence is an ongoing system, not a one-time website
            </h2>
            <p className="text-muted-foreground">
              Most local businesses lose visibility because their information goes stale. Merchant
              Core treats the business record as the product and regenerates everything downstream
              from it.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="h-full">
                <CardHeader className="space-y-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription>{feature.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
              <p className="text-muted-foreground">
                Four steps from an unclaimed business record to a public page that stays accurate.
              </p>
            </div>
            <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="space-y-3">
                  <div className="flex size-9 items-center justify-center rounded-full border bg-background text-sm font-semibold">
                    {index + 1}
                  </div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="for-businesses" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">Built for the business owner</h2>
              <p className="text-muted-foreground">
                The store portal is deliberately plain: sign in, edit your details, publish. No
                page builder, no theme settings, no technical setup.
              </p>
              <ul className="space-y-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline">
                <Link to="/portal">Open the store portal</Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PROOF.map((item) => (
                <Card key={item.title} className="h-full">
                  <CardHeader className="space-y-2">
                    <item.icon className="size-5 text-primary" />
                    <CardTitle className="text-sm">{item.title}</CardTitle>
                    <CardDescription className="text-xs">{item.body}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="get-started" className="scroll-mt-20 border-t bg-primary/5">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Get your business represented properly
            </h2>
            <p className="mt-4 text-muted-foreground">
              Merchant Core is in active development. Businesses are onboarded through an operator
              workspace, which creates your record, links your account, and publishes your page.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/signin">
                  Sign in to continue
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/portal">Merchant portal access</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Operators can open the{" "}
              <Link to="/admin" className="font-medium text-primary hover:underline">
                operator console
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
