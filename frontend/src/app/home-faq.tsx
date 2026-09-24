"use client";

import { useState } from "react";

const questions = [
  ["What is Vidorac?", "Vidorac is a browser-based hub for downloading compatible media from supported public posts."],
  ["Which platforms does Vidorac support?", "Vidorac currently provides focused downloaders for TikTok, Instagram, Facebook, Reddit and X / Twitter."],
  ["Do I need to install anything?", "No. Choose a platform and use its downloader directly in your browser."],
  ["Why are different qualities available for some videos?", "Every source exposes different formats. Vidorac shows the options it can verify for that specific public post."],
  ["Can I download audio?", "Audio-only options are shown when a compatible public source provides usable audio."],
  ["Does Vidorac work on mobile?", "Yes. The interface is designed for phones, tablets and desktop browsers."],
  ["Can every public link be downloaded?", "No. Availability can change because of source restrictions, removed media, regional limits or unsupported post types."],
] as const;

export default function HomeFaq() {
  const [openItem, setOpenItem] = useState<number | null>(null);

  return (
    <div className="home-faq-list">
      {questions.map(([question, answer], index) => {
        const isOpen = openItem === index;
        const panelId = `home-faq-panel-${index}`;
        return (
          <article key={question} className={isOpen ? "is-open" : ""}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenItem(isOpen ? null : index)}
              >
                <span>{question}</span>
                <span className="home-faq-icon" aria-hidden="true">+</span>
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen} className="home-faq-answer">
              <p>{answer}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
