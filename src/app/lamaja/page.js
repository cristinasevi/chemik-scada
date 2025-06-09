import GrafanaEmbed from './GrafanaEmbed';

export default function LamajaPage() {
  return (
      <GrafanaEmbed 
        height="100vh"
        from="now-24h"
        to="now"
        className="w-full h-full"
      />
    </div>
  );
}