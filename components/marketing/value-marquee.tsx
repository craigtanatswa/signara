const THESIS = [
  'Templates',
  'Approval workflows',
  'Digital signatures',
  'Physical signatures',
  'Audit trails',
  'Secure archive',
  'Public verification',
]

export function ValueMarquee() {
  return (
    <section
      aria-label="What Signara covers"
      className="border-y border-white/10 bg-signara-navy py-5"
    >
      <div className="[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] overflow-hidden">
        <div className="animate-marquee flex w-max items-center">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1}
              className="flex items-center"
            >
              {THESIS.map((item) => (
                <li key={item} className="flex items-center">
                  <span className="px-6 font-display text-base tracking-wide text-white sm:px-8 sm:text-lg">
                    {item}
                  </span>
                  <span
                    aria-hidden
                    className="size-1.5 rotate-45 bg-signara-gold"
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}
