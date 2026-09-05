"use client";

import { useEffect, useState } from "react";

type EmailTab = "welcome" | "notifications" | "subscribers";

interface EmailSettings {
  newsletterEnabled: boolean;
  newsletterSubject: string;
  newsletterHeading: string;
  newsletterBody: string;
  newsletterButtonText: string;
  newsletterButtonUrl: string;
  newsletterFooterText: string;
  newsletterNotificationEnabled: boolean;
  newsletterNotificationEmail: string;
}

interface NewsletterSubscriber {
  email: string;
  joinedAt: string;
  status: "active";
  source: "website";
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  newsletterEnabled: true,

  newsletterNotificationEnabled: true,

  newsletterSubject: "Welcome to the MANGOSTA WORLD",
  newsletterHeading: "WELCOME TO THE WORLD",
  newsletterBody:
    "Thank you for joining the MANGOSTA WORLD.\n\nYou are now part of a community built around individuality, design and culture.\n\nStay tuned for new drops, stories and everything happening inside MANGOSTA.",
  newsletterButtonText: "EXPLORE MANGOSTA",
  newsletterButtonUrl: "/",
  newsletterFooterText:
    "MANGOSTA — WEAR YOUR ATTITUDE.",
  newsletterNotificationEmail:
    "mangostateam@gmail.com",
};

export default function AdminEmailPage() {
  const [activeTab, setActiveTab] =
    useState<EmailTab>("welcome");

    const [subscribers, setSubscribers] = useState<
  NewsletterSubscriber[]
>([]);

const [subscribersLoading, setSubscribersLoading] =
  useState(false);

const [subscribersError, setSubscribersError] =
  useState<string | null>(null);

  const [settings, setSettings] =
    useState<EmailSettings>(
      DEFAULT_EMAIL_SETTINGS
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          "/api/admin/settings",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load email settings."
          );
        }

        if (!cancelled) {
          setSettings({
            ...DEFAULT_EMAIL_SETTINGS,
            ...data,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load email settings."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
  if (activeTab !== "subscribers") return;

  let cancelled = false;

  async function loadSubscribers() {
    try {
      setSubscribersLoading(true);
      setSubscribersError(null);

      const response = await fetch(
        "/api/admin/newsletter/subscribers",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to load subscribers."
        );
      }

      if (!cancelled) {
        setSubscribers(
          Array.isArray(data?.subscribers)
            ? data.subscribers
            : []
        );
      }
    } catch (err) {
      if (!cancelled) {
        setSubscribersError(
          err instanceof Error
            ? err.message
            : "Failed to load subscribers."
        );
      }
    } finally {
      if (!cancelled) {
        setSubscribersLoading(false);
      }
    }
  }

  loadSubscribers();

  return () => {
    cancelled = true;
  };
}, [activeTab]);

  const updateSetting = <
    K extends keyof EmailSettings
  >(
    key: K,
    value: EmailSettings[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaved(false);
      setError(null);

      /*
       * Load the complete existing settings first.
       * This prevents Email from accidentally overwriting
       * Hero, Collection or Mangosta Code settings.
       */
      const currentResponse = await fetch(
        "/api/admin/settings",
        {
          cache: "no-store",
        }
      );

      const currentSettings =
        await currentResponse.json();

      if (!currentResponse.ok) {
        throw new Error(
          currentSettings?.error ||
            "Failed to load current settings."
        );
      }

      const updatedSettings = {
        ...currentSettings,

        newsletterEnabled:
          settings.newsletterEnabled,

        newsletterSubject:
          settings.newsletterSubject,

        newsletterHeading:
          settings.newsletterHeading,

        newsletterBody:
          settings.newsletterBody,

        newsletterButtonText:
          settings.newsletterButtonText,

        newsletterButtonUrl:
          settings.newsletterButtonUrl,

        newsletterFooterText:
          settings.newsletterFooterText,

        newsletterNotificationEnabled:
  settings.newsletterNotificationEnabled,

newsletterNotificationEmail:
  settings.newsletterNotificationEmail,
      };

      const response = await fetch(
        "/api/admin/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            updatedSettings
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to save email settings."
        );
      }

      setSettings({
        ...DEFAULT_EMAIL_SETTINGS,
        ...data,
      });

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

  const tabs = [
    {
      id: "welcome" as const,
      label: "Welcome Email",
    },
    {
      id: "notifications" as const,
      label: "Notifications",
    },
    {
      id: "subscribers" as const,
      label: "Subscribers",
    },
  ];

  if (isLoading) {
    return (
      <div>
        <p className="label-technical mb-2">
          COMMUNICATION
        </p>

        <h1 className="font-display text-3xl tracking-tight text-bone">
          Email
        </h1>

        <p className="mt-8 text-sm text-stone">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-10">
        <p className="label-technical mb-2">
          COMMUNICATION
        </p>

        <h1 className="font-display text-3xl tracking-tight text-bone">
          Email
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-stone">
          Manage MANGOSTA WORLD emails,
          notifications and subscribers from
          one place.
        </p>
      </div>

      {/* ================================================= */}
      {/* ERROR */}
      {/* ================================================= */}

      {error && (
        <div className="mb-8 border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ================================================= */}
      {/* TABS */}
      {/* ================================================= */}

      <div className="mb-10 flex flex-wrap border-b border-line">
        {tabs.map((tab) => {
          const active =
            activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id)
              }
              className={`border-b-2 px-4 py-3 text-xs uppercase tracking-[0.18em] transition-colors ${
                active
                  ? "border-bone text-bone"
                  : "border-transparent text-stone hover:text-bone-dim"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================================================= */}
      {/* WELCOME EMAIL */}
      {/* ================================================= */}

      {activeTab === "welcome" && (
        <section className="max-w-3xl">
          <div className="mb-8">
            <p className="label-technical mb-2">
              WELCOME EMAIL
            </p>

            <h2 className="font-display text-xl text-bone">
              New Member Welcome
            </h2>

            <p className="mt-2 text-sm leading-6 text-stone">
              This email will be sent automatically
              when someone joins the MANGOSTA WORLD.
            </p>
          </div>

          <div className="flex flex-col gap-7">
            {/* ENABLE */}
            <div className="flex items-center justify-between border border-line px-4 py-4">
              <div>
                <p className="text-sm text-bone">
                  Send welcome email
                </p>

                <p className="mt-1 text-xs text-stone">
                  Automatically welcome every new
                  member.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSetting(
                    "newsletterEnabled",
                    !settings.newsletterEnabled
                  )
                }
                className={`relative h-6 w-11 border transition-colors ${
                  settings.newsletterEnabled
                    ? "border-bone bg-bone"
                    : "border-line bg-void"
                }`}
                aria-label="Toggle welcome email"
                aria-pressed={
                  settings.newsletterEnabled
                }
              >
                <span
                  className={`absolute top-1 h-4 w-4 transition-all ${
                    settings.newsletterEnabled
                      ? "left-6 bg-void"
                      : "left-1 bg-stone"
                  }`}
                />
              </button>
            </div>

            {/* SUBJECT */}
            <label className="flex flex-col gap-2">
              <span className="text-xs text-stone">
                Email Subject
              </span>

              <input
                type="text"
                value={
                  settings.newsletterSubject
                }
                onChange={(e) =>
                  updateSetting(
                    "newsletterSubject",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Enter email subject"
              />
            </label>

            {/* HEADING */}
            <label className="flex flex-col gap-2">
              <span className="text-xs text-stone">
                Email Heading
              </span>

              <input
                type="text"
                value={
                  settings.newsletterHeading
                }
                onChange={(e) =>
                  updateSetting(
                    "newsletterHeading",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="Enter email heading"
              />
            </label>

            {/* MESSAGE */}
            <label className="flex flex-col gap-2">
              <span className="text-xs text-stone">
                Welcome Message
              </span>

              <textarea
                value={
                  settings.newsletterBody
                }
                onChange={(e) =>
                  updateSetting(
                    "newsletterBody",
                    e.target.value
                  )
                }
                rows={10}
                className={`${inputClass} resize-y leading-6`}
                placeholder="Write your welcome email..."
              />

              <span className="text-[11px] text-stone">
                Separate paragraphs using an empty
                line.
              </span>
            </label>

            {/* BUTTON */}
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs text-stone">
                  Button Text
                </span>

                <input
                  type="text"
                  value={
                    settings.newsletterButtonText
                  }
                  onChange={(e) =>
                    updateSetting(
                      "newsletterButtonText",
                      e.target.value
                    )
                  }
                  className={inputClass}
                  placeholder="EXPLORE MANGOSTA"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs text-stone">
                  Button URL
                </span>

                <input
                  type="text"
                  value={
                    settings.newsletterButtonUrl
                  }
                  onChange={(e) =>
                    updateSetting(
                      "newsletterButtonUrl",
                      e.target.value
                    )
                  }
                  className={inputClass}
                  placeholder="/"
                />
              </label>
            </div>

            {/* FOOTER */}
            <label className="flex flex-col gap-2">
              <span className="text-xs text-stone">
                Footer Message
              </span>

              <input
                type="text"
                value={
                  settings.newsletterFooterText
                }
                onChange={(e) =>
                  updateSetting(
                    "newsletterFooterText",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="MANGOSTA — WEAR YOUR ATTITUDE."
              />
            </label>

            {/* ================================================= */}
            {/* EMAIL PREVIEW */}
            {/* ================================================= */}

            <div className="border-t border-line pt-7">
              <p className="label-technical mb-4">
                EMAIL PREVIEW
              </p>

              <div className="overflow-hidden border border-line bg-[#0b0b0b]">
                {/* HEADER */}
                <div className="border-b border-white/10 px-6 py-5">
                  <p className="font-display text-sm tracking-[0.12em] text-bone">
                    MANGOSTA
                  </p>
                </div>

                {/* BODY */}
                <div className="px-6 py-10 sm:px-10">
                  <p className="mb-4 text-[10px] uppercase tracking-[0.25em] text-stone">
                    WELCOME TO THE WORLD
                  </p>

                  <h3 className="font-display text-2xl tracking-tight text-bone">
                    {settings.newsletterHeading ||
                      "YOUR HEADING"}
                  </h3>

                  <div className="mt-6 space-y-4">
                    {settings.newsletterBody
                      .split(/\n\s*\n/)
                      .filter(Boolean)
                      .map(
                        (
                          paragraph,
                          index
                        ) => (
                          <p
                            key={index}
                            className="whitespace-pre-line text-sm leading-7 text-stone"
                          >
                            {paragraph}
                          </p>
                        )
                      )}
                  </div>

                  {settings.newsletterButtonText.trim() && (
                    <div className="mt-8">
                      <span className="inline-block bg-bone px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-void">
                        {
                          settings.newsletterButtonText
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div className="border-t border-white/10 px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-stone">
                    {
                      settings.newsletterFooterText
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* SAVE */}
            <div className="flex items-center justify-end gap-4 border-t border-line pt-7">
              {saved && (
                <span className="text-xs text-mango">
                  Saved successfully.
                </span>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "SAVING…"
                  : "SAVE WELCOME EMAIL"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* NOTIFICATIONS */}
      {/* ================================================= */}

      {activeTab === "notifications" && (
        <section className="max-w-3xl">
          <div className="mb-8">
            <p className="label-technical mb-2">
              ADMIN NOTIFICATIONS
            </p>

            <h2 className="font-display text-xl text-bone">
              Email Notifications
            </h2>

            <p className="mt-2 text-sm leading-6 text-stone">
              Choose where MANGOSTA receives
              notifications when someone joins the
              MANGOSTA WORLD.
            </p>
          </div>

          <div className="flex flex-col gap-7">
            <div className="flex items-center justify-between border border-line px-4 py-4">
  <div>
    <p className="text-sm text-bone">
      Send admin notification
    </p>

    <p className="mt-1 text-xs text-stone">
      Receive an email whenever someone joins the
      MANGOSTA WORLD.
    </p>
  </div>

  <button
    type="button"
    onClick={() =>
      updateSetting(
        "newsletterNotificationEnabled",
        !settings.newsletterNotificationEnabled
      )
    }
    aria-label={
      settings.newsletterNotificationEnabled
        ? "Disable admin notifications"
        : "Enable admin notifications"
    }
    className={`relative h-6 w-11 border transition-colors ${
      settings.newsletterNotificationEnabled
        ? "border-mango bg-mango"
        : "border-line-strong bg-transparent"
    }`}
  >
    <span
      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-transform ${
        settings.newsletterNotificationEnabled
          ? "translate-x-5 bg-void"
          : "translate-x-1 bg-stone"
      }`}
    />
  </button>
</div>
            <label className="flex flex-col gap-2">
              <span className="text-xs text-stone">
                Notification Email
              </span>

              <input
                type="email"
                value={
                  settings.newsletterNotificationEmail
                }
                onChange={(e) =>
                  updateSetting(
                    "newsletterNotificationEmail",
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="mangostateam@gmail.com"
              />

              <span className="text-[11px] leading-5 text-stone">
                A notification will be sent here whenever
                a new MANGOSTA WORLD member joins.
              </span>
            </label>

            <div className="border border-line p-5">
              <p className="label-technical mb-3">
                NOTIFICATION CONTENT
              </p>

              <p className="text-sm leading-6 text-stone">
                The notification will contain the new
                member&apos;s email address, joining date
                and signup source.
              </p>
            </div>

            <div className="flex items-center justify-end gap-4 border-t border-line pt-7">
              {saved && (
                <span className="text-xs text-mango">
                  Saved successfully.
                </span>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "SAVING…"
                  : "SAVE NOTIFICATIONS"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* SUBSCRIBERS */}
      {/* ================================================= */}

      {activeTab === "subscribers" && (
        <section>
          <div className="mb-8">
            <p className="label-technical mb-2">
              MANGOSTA WORLD
            </p>

            <h2 className="font-display text-xl text-bone">
              Subscribers
            </h2>

            <p className="mt-2 text-sm leading-6 text-stone">
              People who have joined the MANGOSTA WORLD
              will appear here.
            </p>
          </div>

          <div className="border border-line">
  {subscribersLoading ? (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg text-bone">
        Loading subscribers…
      </p>

      <p className="mt-2 text-sm text-stone">
        Fetching members from the MANGOSTA WORLD database.
      </p>
    </div>
  ) : subscribersError ? (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg text-red-300">
        Unable to load subscribers
      </p>

      <p className="mt-2 text-sm text-stone">
        {subscribersError}
      </p>

      <button
        type="button"
        onClick={() => {
          setActiveTab("welcome");
          setTimeout(() => {
            setActiveTab("subscribers");
          }, 0);
        }}
        className="mt-6 border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-bone"
      >
        RETRY
      </button>
    </div>
  ) : subscribers.length === 0 ? (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg text-bone">
        No subscribers yet
      </p>

      <p className="mt-2 text-sm text-stone">
        New members will appear here after they join
        the MANGOSTA WORLD.
      </p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px]">
        <thead>
          <tr className="border-b border-line bg-[#0b0b0b]">
            <th className="px-6 py-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-stone">
              Email
            </th>

            <th className="px-6 py-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-stone">
              Joined
            </th>

            <th className="px-6 py-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-stone">
              Source
            </th>

            <th className="px-6 py-4 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-stone">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {subscribers.map((subscriber) => (
            <tr
              key={`${subscriber.email}-${subscriber.joinedAt}`}
              className="border-b border-line last:border-b-0 transition-colors hover:bg-white/[0.02]"
            >
              <td className="px-6 py-5 text-sm text-bone">
                {subscriber.email}
              </td>

              <td className="px-6 py-5 text-sm text-stone">
                {new Date(
                  subscriber.joinedAt
                ).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>

              <td className="px-6 py-5 text-xs uppercase tracking-[0.12em] text-stone">
                {subscriber.source}
              </td>

              <td className="px-6 py-5">
                <span className="inline-flex border border-mango/30 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-mango">
                  {subscriber.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
        </section>
      )}
    </div>
  );
}