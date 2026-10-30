import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatTime } from "@/lib/utils";
import { safeExportFilename } from "@/lib/registration-export";
import { StartlineLogo } from "@/lib/startline-logo-pdf";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#141414",
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 44,
    paddingHorizontal: 46,
    paddingBottom: 102,
  },
  accent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#B3E153",
  },
  organiser: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#6E737B",
    marginBottom: 10,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 27,
    lineHeight: 1.15,
    letterSpacing: -0.6,
    marginBottom: 20,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detail: {
    width: "47%",
    marginRight: "6%",
    marginBottom: 8,
  },
  detailWide: {
    width: "100%",
    marginBottom: 0,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#8A8F98",
    marginBottom: 3,
  },
  value: {
    fontSize: 10.5,
    color: "#141414",
  },
  qrBlock: {
    marginTop: 26,
    alignItems: "center",
  },
  qr: {
    width: 380,
    height: 380,
  },
  scanTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 5,
    textAlign: "center",
  },
  scanHint: {
    fontSize: 9.5,
    color: "#6E737B",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 46,
    right: 46,
    bottom: 38,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  footerMeta: {
    fontSize: 8,
    color: "#8A8F98",
    textAlign: "right",
  },
});

function formatEventDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventTime(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

function CheckInQrDoc(props: {
  eventTitle: string;
  organiserName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  state: string;
  qrDataUrl: string;
}) {
  const location = [props.venue, props.city, props.state.toUpperCase()]
    .filter(Boolean)
    .join(", ");

  return (
    <Document title={`${props.eventTitle} — check-in QR`} author="Startline">
      <Page size="A4" style={styles.page}>
        <View style={styles.accent} fixed />

        <Text style={styles.organiser}>{props.organiserName}</Text>
        <Text style={styles.title}>{props.eventTitle}</Text>

        <View style={styles.details}>
          <View style={styles.detail}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatEventDate(props.eventDate)}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>
              {formatEventTime(props.startTime, props.endTime)}
            </Text>
          </View>
          <View style={styles.detailWide}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{location}</Text>
          </View>
        </View>

        <View style={styles.qrBlock}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.qr} src={props.qrDataUrl} />
          <Text style={styles.scanTitle}>Scan to check in</Text>
          <Text style={styles.scanHint}>
            Point your phone camera at the code, then sign in to check yourself in.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <StartlineLogo width={150} />
          <Text style={styles.footerMeta}>startlineau.com</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildCheckInQrPdf(opts: {
  eventTitle: string;
  organiserName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  state: string;
  qrDataUrl: string;
}): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <CheckInQrDoc
      eventTitle={opts.eventTitle}
      organiserName={opts.organiserName}
      eventDate={opts.eventDate}
      startTime={opts.startTime}
      endTime={opts.endTime}
      venue={opts.venue}
      city={opts.city}
      state={opts.state}
      qrDataUrl={opts.qrDataUrl}
    />,
  );
  return Buffer.from(buffer);
}

export function checkInQrPdfFilename(eventTitle: string): string {
  return `${safeExportFilename(eventTitle)}-check-in-qr.pdf`;
}
