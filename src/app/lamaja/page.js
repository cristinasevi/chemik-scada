import GrafanaEmbed from './GrafanaEmbed';

export default function LamajaPage() {
  return (
    <div className="h-screen w-full">
      <GrafanaEmbed 
        height="100vh"
        from="now-24h"
        to="now"
        className="w-full h-full"
      />
    </div>
  );
}