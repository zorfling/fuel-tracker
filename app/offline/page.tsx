export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-3xl font-semibold">You&apos;re offline</div>
        <p className="text-slate-300">
          Fuel Tracker needs a connection to fetch the latest prices. Please reconnect and try again.
        </p>
      </div>
    </div>
  );
}
