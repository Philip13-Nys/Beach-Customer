import { useEffect } from "react";
import { X } from "lucide-react";

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
};

const termsSections = [
  {
    id: "services",
    title: "1. OUR SERVICES",
    content: (
      <p>
        The information provided when using the Services is not intended for
        distribution to or use by any person or entity in any jurisdiction or
        country where such distribution or use would be contrary to law or
        regulation or which would subject us to any registration requirement
        within such jurisdiction or country. Accordingly, those persons who
        choose to access the Services from other locations do so on their own
        initiative and are solely responsible for compliance with local laws, if
        and to the extent local laws are applicable.
      </p>
    ),
  },
  {
    id: "ip",
    title: "2. INTELLECTUAL PROPERTY RIGHTS",
    content: (
      <>
        <h3 className="text-base font-semibold mt-4 mb-2">
          Our intellectual property
        </h3>
        <p>
          We are the owner or the licensee of all intellectual property rights
          in our Services, including all source code, databases, functionality,
          software, website designs, audio, video, text, photographs, and
          graphics in the Services (collectively, the "Content"), as well as the
          trademarks, service marks, and logos contained therein (the "Marks").
        </p>
        <p className="mt-3">
          Our Content and Marks are protected by copyright and trademark laws
          around the world. The Content and Marks are provided in or through the
          Services "AS IS" for your personal, non-commercial use or internal
          business purpose only.
        </p>

        <h3 className="text-base font-semibold mt-4 mb-2">
          Your use of our Services
        </h3>
        <p>
          Subject to your compliance with these Legal Terms, including the
          "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive,
          non-transferable, revocable license to access the Services solely for
          your personal or internal business use.
        </p>
      </>
    ),
  },
  {
    id: "userreps",
    title: "3. USER REPRESENTATIONS",
    content: (
      <p>
        By using the Services, you represent and warrant that: (1) you have the
        legal capacity and you agree to comply with these Legal Terms; (2) you
        are not a minor in the jurisdiction in which you reside; (3) you will
        not access the Services through automated or non-human means, whether
        through a bot, script or otherwise; (4) you will not use the Services
        for any illegal or unauthorized purpose; and (5) your use of the
        Services will not violate any applicable law or regulation.
      </p>
    ),
  },
  {
    id: "prohibited",
    title: "4. PROHIBITED ACTIVITIES",
    content: (
      <p>
        You may not access or use the Services for any purpose other than that
        for which we make the Services available. The Services may not be used
        in connection with any commercial endeavors except those that are
        specifically endorsed or approved by us.
      </p>
    ),
  },
  {
    id: "ugc",
    title: "5. USER GENERATED CONTRIBUTIONS",
    content: (
      <p>
        The Services may invite you to chat, contribute to, or participate in
        blogs, message boards, online forums, and other functionality. Any
        material, information, or ideas you transmit to us by any means will be
        treated as non-confidential and non-proprietary.
      </p>
    ),
  },
  {
    id: "license",
    title: "6. CONTRIBUTION LICENSE",
    content: (
      <p>
        By posting your Contributions to any part of the Services, you
        automatically grant us an unrestricted, unlimited, irrevocable,
        perpetual, non-exclusive, transferable, royalty-free, fully-paid right
        and license to host, use, copy, reproduce, and distribute such
        Contributions.
      </p>
    ),
  },
  {
    id: "reviews",
    title: "7. GUIDELINES FOR REVIEWS",
    content: (
      <p>
        We may provide you areas on the Services to leave reviews or ratings.
        When posting a review, you must comply with the following criteria: (1)
        you should have firsthand experience with the person/entity being
        reviewed; (2) your reviews should not contain offensive profanity, or
        abusive, racist, offensive, or hate language; and (3) your reviews
        should not contain false or misleading statements.
      </p>
    ),
  },
  {
    id: "sitemanage",
    title: "8. SERVICES MANAGEMENT",
    content: (
      <p>
        We reserve the right, but not the obligation, to: (1) monitor the
        Services for violations of these Legal Terms; (2) take appropriate legal
        action against anyone who, in our sole discretion, violates the law or
        these Legal Terms; and (3) otherwise manage the Services in a manner
        designed to protect our rights and property and to facilitate the proper
        functioning of the Services.
      </p>
    ),
  },
  {
    id: "ppno",
    title: "9. PRIVACY POLICY",
    content: (
      <p>
        We care about data privacy and security. By using the Services, you
        agree to be bound by our Privacy Policy posted on the Services, which is
        incorporated into these Legal Terms.
      </p>
    ),
  },
  {
    id: "terms",
    title: "10. TERM AND TERMINATION",
    content: (
      <p>
        These Legal Terms shall remain in full force and effect while you use
        the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS,
        WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR
        LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES TO ANY PERSON FOR ANY
        REASON.
      </p>
    ),
  },
  {
    id: "modifications",
    title: "11. MODIFICATIONS AND INTERRUPTIONS",
    content: (
      <p>
        We reserve the right to change, modify, or remove the contents of the
        Services at any time or for any reason at our sole discretion without
        notice. We cannot guarantee the Services will be available at all times.
        We may experience hardware, software, or other problems resulting in
        interruptions, delays, or errors.
      </p>
    ),
  },
  {
    id: "law",
    title: "12. GOVERNING LAW",
    content: (
      <p>
        These Legal Terms and your use of the Services are governed by and
        construed in accordance with the laws of the Republic of the Philippines
        applicable to agreements made and to be entirely performed within the
        Philippines.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "13. DISPUTE RESOLUTION",
    content: (
      <p>
        Any legal action of whatever nature brought by either you or us shall be
        commenced or prosecuted in the courts located in the Philippines, and
        the parties hereby consent to, and waive all defenses of lack of
        personal jurisdiction and forum non conveniens with respect to venue and
        jurisdiction in such courts.
      </p>
    ),
  },
  {
    id: "corrections",
    title: "14. CORRECTIONS",
    content: (
      <p>
        There may be information on the Services that contains typographical
        errors, inaccuracies, or omissions. We reserve the right to correct any
        errors, inaccuracies, or omissions and to change or update the
        information on the Services at any time, without prior notice.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "15. DISCLAIMER",
    content: (
      <p>
        THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE
        THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST
        EXTENT PERMISSIBLE BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR
        IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF.
      </p>
    ),
  },
  {
    id: "liability",
    title: "16. LIMITATIONS OF LIABILITY",
    content: (
      <p>
        IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO
        YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL,
        EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST
        PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR
        USE OF THE SERVICES.
      </p>
    ),
  },
  {
    id: "indemnification",
    title: "17. INDEMNIFICATION",
    content: (
      <p>
        You agree to defend, indemnify, and hold us harmless, including our
        subsidiaries, affiliates, and all of our respective officers, agents,
        partners, and employees, from and against any loss, damage, liability,
        claim, or demand made by any third party due to or arising out of your
        use of the Services.
      </p>
    ),
  },
  {
    id: "userdata",
    title: "18. USER DATA",
    content: (
      <p>
        We will maintain certain data that you transmit to the Services for the
        purpose of managing the performance of the Services, as well as data
        relating to your use of the Services. You are solely responsible for all
        data that you transmit or that relates to any activity you have
        undertaken using the Services.
      </p>
    ),
  },
  {
    id: "electronic",
    title: "19. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES",
    content: (
      <p>
        Visiting the Services, sending us emails, and completing online forms
        constitute electronic communications. You consent to receive electronic
        communications, and you agree that all agreements, notices, disclosures,
        and other communications we provide to you electronically satisfy any
        legal requirement that such communication be in writing.
      </p>
    ),
  },
  {
    id: "misc",
    title: "20. MISCELLANEOUS",
    content: (
      <p>
        These Legal Terms and any policies or operating rules posted by us on
        the Services or in respect to the Services constitute the entire
        agreement and understanding between you and us. Our failure to exercise
        or enforce any right or provision of these Legal Terms shall not operate
        as a waiver of such right or provision.
      </p>
    ),
  },
  {
    id: "contact",
    title: "21. CONTACT US",
    content: (
      <>
        <p>
          In order to resolve a complaint regarding the Services or to receive
          further information regarding use of the Services, please contact us
          at:
        </p>

        <p className="mt-3">
          <strong>Sabang Beach and Diving Resort</strong>
          <br />
          Sabang, Puerto Galera
          <br />
          Oriental Mindoro, Philippines
          <br />
          Phone: 09914673564
          <br />
          Email:{" "}
          <a
            href="mailto:sabangbeach@gmail.com"
            className="text-blue-600 underline"
          >
            sabangbeach@gmail.com
          </a>
        </p>
      </>
    ),
  },
];

export default function TermsModal({ open, onClose }: TermsModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/50 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-background px-5 py-4 sm:px-8">
          <div>
            <h2
              id="terms-modal-title"
              className="text-xl font-bold text-primary sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Terms and Conditions
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Sabang Beach and Diving Resort
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Last updated: October 23, 2026
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Terms and Conditions"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Terms Content */}
        <div className="overflow-y-auto px-5 py-6 sm:px-8">
          {/* Introduction */}
          <div className="mb-6">
            <h3
              className="mb-3 text-lg font-bold text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              AGREEMENT TO OUR LEGAL TERMS
            </h3>

            <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
              <p>
                We are <strong>Sabang Beach and Diving Resort</strong> (
                <strong>"Company," "we," "us," "our"</strong>), a company
                registered in the Philippines at Sabang, Puerto Galera, Oriental
                Mindoro, Philippines.
              </p>

              <p>
                We operate the website{" "}
                <a
                  href="https://diving-resort.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-primary underline hover:text-accent"
                >
                  https://diving-resort.web.app
                </a>{" "}
                (the <strong>"Site"</strong>), as well as any other related
                products and services that refer or link to these legal terms
                (the <strong>"Legal Terms"</strong>) (collectively, the{" "}
                <strong>"Services"</strong>).
              </p>

              <p>
                You can contact us by phone at <strong>09914673564</strong>,
                email at{" "}
                <a
                  href="mailto:sabangbeach@gmail.com"
                  className="text-primary underline hover:text-accent"
                >
                  sabangbeach@gmail.com
                </a>
                , or by mail to Sabang, Puerto Galera, Oriental Mindoro,
                Philippines.
              </p>

              <p>
                These Legal Terms constitute a legally binding agreement made
                between you, whether personally or on behalf of an entity (
                <strong>"you"</strong>), and Sabang Beach and Diving Resort,
                concerning your access to and use of the Services. You agree
                that by accessing the Services, you have read, understood, and
                agreed to be bound by all of these Legal Terms.{" "}
                <strong>
                  IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU
                  ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST
                  DISCONTINUE USE IMMEDIATELY.
                </strong>
              </p>

              <p>
                We will provide you with prior notice of any scheduled changes
                to the Services you are using. The modified Legal Terms will
                become effective upon posting or notifying you by email. By
                continuing to use the Services after the effective date of any
                changes, you agree to be bound by the modified terms.
              </p>

              <p>
                We recommend that you print a copy of these Legal Terms for your
                records.
              </p>
            </div>
          </div>

          <div className="my-6 border-t border-border" />

          {/* Table of Contents */}
          <div className="mb-8 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
            <h3
              className="mb-4 text-lg font-bold text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              TABLE OF CONTENTS
            </h3>

            <ol className="space-y-2 text-sm">
              {termsSections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className="text-left text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="my-6 border-t border-border" />

          {/* Terms Sections */}
          <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
            {termsSections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-4">
                <h3
                  className="mb-3 border-l-4 border-accent pl-3 text-base font-bold text-primary"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {section.title}
                </h3>

                <div className="space-y-3">{section.content}</div>
              </section>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:px-8">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Sabang Beach and Diving Resort
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
