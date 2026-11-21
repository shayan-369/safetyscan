export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="label-caps mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0F172A] sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#64748B]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}