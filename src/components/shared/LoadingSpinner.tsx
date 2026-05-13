export default function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="row-flex muted small">
      <span className="spinner" aria-hidden /> {message}
    </div>
  );
}
