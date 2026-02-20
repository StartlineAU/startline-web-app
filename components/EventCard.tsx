import { Calendar, Clock, MapPin, Users, DollarSign, Image } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS } from "@/types";
import { formatEventDate, formatTime, getEventTypeColor } from "@/lib/utils";

interface EventCardProps {
  event: FitnessEvent;
  variant?: "default" | "compact" | "featured";
}

export default function EventCard({
  event,
  variant = "default",
}: EventCardProps) {
  const typeLabel = EVENT_TYPE_LABELS[event.type];

  if (variant === "compact") {
    return (
      <article className="bg-white rounded-xl shadow-sm border border-light-dark overflow-hidden hover:shadow-md transition-shadow duration-300 group">
        {/* Image Placeholder */}
        <div className="relative aspect-video image-placeholder overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Image className="w-8 h-8 text-muted mx-auto mb-1" />
              <p className="text-muted text-xs">Event Photo</p>
            </div>
          </div>
          {/* Type Badge */}
          <span className="absolute top-2 left-2 text-xs font-medium bg-primary text-dark px-2 py-1 rounded-full">
            {typeLabel}
          </span>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-semibold text-dark text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted">
            <Calendar className="w-3 h-3" />
            <span>{formatEventDate(event.date).split(",")[1]?.trim()}</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "featured") {
    return (
      <article className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
        <div className="md:flex">
          {/* Image Placeholder */}
          <div className="relative md:w-2/5 aspect-video md:aspect-auto image-placeholder overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Image className="w-12 h-12 text-muted mx-auto mb-2" />
                <p className="text-muted text-sm">Featured Image</p>
                <p className="text-muted-dark text-xs">600 x 400</p>
              </div>
            </div>
            {/* Popularity Badge */}
            {event.popularity >= 90 && (
              <span className="absolute top-4 right-4 bg-primary text-dark text-xs font-semibold px-3 py-1 rounded-full">
                Trending
              </span>
            )}
          </div>

          {/* Content */}
          <div className="p-6 md:w-3/5 flex flex-col justify-between">
            <div>
              {/* Type Badge */}
              <span className="inline-block text-xs font-medium bg-primary/10 text-dark px-3 py-1 rounded-full mb-3">
                {typeLabel}
              </span>

              <h3 className="text-xl font-bold text-dark mb-2 group-hover:text-primary transition-colors">
                {event.title}
              </h3>

              <p className="text-muted text-sm mb-4 line-clamp-2">
                {event.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{formatEventDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>
                    {formatTime(event.time)}
                    {event.endTime && ` - ${formatTime(event.endTime)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{event.location}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-light-dark">
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-primary">
                  {event.price}
                </span>
                {event.spotsLeft !== undefined && (
                  <span className="text-xs text-muted">
                    {event.spotsLeft} spots left
                  </span>
                )}
              </div>
              <button className="bg-primary text-dark px-4 py-2 rounded-lg font-medium hover:bg-primary-light transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Default variant
  return (
    <article className="bg-white rounded-xl shadow-sm border border-light-dark overflow-hidden hover:shadow-lg transition-all duration-300 group animate-fade-in">
      {/* Image Placeholder */}
      <div className="relative aspect-[16/10] image-placeholder overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <div className="text-center">
            <Image className="w-10 h-10 text-muted mx-auto mb-2" />
            <p className="text-muted text-sm">Event Photo</p>
            <p className="text-muted-dark text-xs">400 x 250</p>
          </div>
        </div>

        {/* Type Badge */}
        <span className="absolute top-3 left-3 text-xs font-medium bg-primary text-dark px-3 py-1 rounded-full shadow-sm">
          {typeLabel}
        </span>

        {/* Price Badge */}
        <span className="absolute top-3 right-3 text-sm font-bold bg-white/90 backdrop-blur-sm text-dark px-3 py-1 rounded-full shadow-sm">
          {event.price}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-dark text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {event.title}
        </h3>

        <p className="text-muted text-sm mb-4 line-clamp-2">
          {event.description}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">{formatEventDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock className="w-4 h-4 text-primary flex-shrink-0" />
            <span>
              {formatTime(event.time)}
              {event.endTime && ` - ${formatTime(event.endTime)}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-light-dark">
          {event.spotsLeft !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Users className="w-3 h-3" />
              <span>{event.spotsLeft} spots left</span>
            </div>
          )}
          <button className="ml-auto bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary hover:text-dark transition-colors duration-200">
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}
