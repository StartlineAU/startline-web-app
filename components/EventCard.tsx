import { Calendar, MapPin, Users, ExternalLink, Image, Award } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatTime } from "@/lib/utils";

interface EventCardProps {
  event: FitnessEvent;
  variant?: "default" | "compact" | "list";
}

export default function EventCard({
  event,
  variant = "default",
}: EventCardProps) {
  const typeLabel = EVENT_TYPE_LABELS[event.type];
  const stateLabel = STATE_LABELS[event.state];

  const formatBadge = event.format === "team" ? "Team" : event.format === "both" ? "Individual & Team" : "Individual";

  if (variant === "compact") {
    return (
      <article className="bg-dark rounded-lg border border-dark-light overflow-hidden hover:border-dark-lighter transition-colors group">
        {/* Image Placeholder */}
        <div className="relative aspect-[16/9] image-placeholder overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <Image className="w-8 h-8 text-dark-lighter" />
          </div>
          <span className="absolute top-2 left-2 text-xs font-semibold bg-primary text-dark px-2 py-1 rounded">
            {typeLabel}
          </span>
          {event.isOfficial && (
            <span className="absolute top-2 right-2 text-xs font-medium bg-dark/80 text-primary px-2 py-1 rounded flex items-center gap-1">
              <Award className="w-3 h-3" />
              Official
            </span>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted">
            <Calendar className="w-3 h-3 text-primary" />
            <span>{formatMediumDate(event.date)}</span>
            <span className="text-dark-lighter">·</span>
            <span>{stateLabel}</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article className="bg-dark rounded-lg border border-dark-light p-4 hover:border-dark-lighter transition-colors group">
        <div className="flex gap-4">
          {/* Date Block */}
          <div className="flex-shrink-0 w-16 text-center">
            <div className="bg-dark-light rounded-lg py-2 px-3">
              <p className="text-xs text-muted uppercase">
                {new Date(event.date).toLocaleDateString("en-AU", { month: "short" })}
              </p>
              <p className="text-2xl font-bold text-white">
                {new Date(event.date).getDate()}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-primary text-dark px-2 py-0.5 rounded">
                    {typeLabel}
                  </span>
                  {event.isOfficial && (
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Official
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <p className="text-sm text-muted line-clamp-1 mt-1">
                  {event.description}
                </p>
              </div>
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Register
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary" />
                {event.city}, {stateLabel}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4 text-primary" />
                {formatBadge}
              </span>
              {event.distance && (
                <span className="text-muted-dark">{event.distance}</span>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Default card variant
  return (
    <article className="bg-dark rounded-lg border border-dark-light overflow-hidden hover:border-dark-lighter transition-all duration-300 group">
      {/* Image Placeholder */}
      <div className="relative aspect-[16/10] image-placeholder overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Image className="w-10 h-10 text-dark-lighter mx-auto mb-2" />
            <p className="text-dark-lighter text-xs">Event Image</p>
          </div>
        </div>

        {/* Type Badge */}
        <span className="absolute top-3 left-3 text-xs font-semibold bg-primary text-dark px-3 py-1 rounded">
          {typeLabel}
        </span>

        {/* Official Badge */}
        {event.isOfficial && (
          <span className="absolute top-3 right-3 text-xs font-medium bg-dark/80 backdrop-blur-sm text-primary px-2 py-1 rounded flex items-center gap-1">
            <Award className="w-3 h-3" />
            Official
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {event.title}
        </h3>

        <p className="text-muted text-sm mb-4 line-clamp-2">
          {event.description}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{formatMediumDate(event.date)}</span>
            <span className="text-dark-lighter">·</span>
            <span>{formatTime(event.time)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">{event.city}, {stateLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{formatBadge}</span>
            {event.distance && (
              <>
                <span className="text-dark-lighter">·</span>
                <span>{event.distance}</span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <a
          href={event.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-dark-light text-white py-2.5 rounded font-medium hover:bg-primary hover:text-dark transition-colors duration-200"
        >
          Register
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </article>
  );
}
