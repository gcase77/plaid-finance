type LoadingSpinnerProps = { message?: string };

export default function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="text-muted d-flex align-items-center">
      <span className="spinner-border spinner-border-sm me-2" role="status" />
      {message}
    </div>
  );
}
