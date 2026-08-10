export const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="text-text-light-tertiary">Work Package in progress...</p>
  </div>
);
