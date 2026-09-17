import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  formatStartListGroupTitle,
  groupByStartWave,
  type ExportRegistrationRow,
} from "@/lib/registration-export";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#141414",
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: "#141414",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#444444",
    marginBottom: 2,
  },
  waveTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#141414",
    paddingBottom: 3,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  colBib: { width: "8%" },
  colName: { width: "28%" },
  colCategory: { width: "18%" },
  colGender: { width: "12%" },
  colPhone: { width: "24%" },
  colMed: { width: "10%", textAlign: "right" },
  // The eight-column layout, used only when the event actually sold
  // merchandise. An event with no add-ons keeps the widths above rather than
  // carrying two empty columns across every page of its start list.
  colBibNarrow: { width: "7%" },
  colNameNarrow: { width: "19%" },
  colCategoryNarrow: { width: "13%" },
  colGenderNarrow: { width: "8%" },
  colPhoneNarrow: { width: "15%" },
  colExtras: { width: "20%" },
  // Right aligned like every other money column, so the cents line up down the
  // page and the tent can total a column by eye.
  colExtrasPaid: { width: "10%", textAlign: "right" },
  colMedNarrow: { width: "8%", textAlign: "right" },
  headerCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#666666",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/**
 * Column widths for one start list, picked once for the whole document.
 *
 * Deciding per page would make the same column a different width from page to
 * page, so this is a property of the export, not of the rows on a given page.
 */
function columnsFor(withExtras: boolean) {
  return withExtras
    ? {
        bib: styles.colBibNarrow,
        name: styles.colNameNarrow,
        category: styles.colCategoryNarrow,
        gender: styles.colGenderNarrow,
        phone: styles.colPhoneNarrow,
        med: styles.colMedNarrow,
      }
    : {
        bib: styles.colBib,
        name: styles.colName,
        category: styles.colCategory,
        gender: styles.colGender,
        phone: styles.colPhone,
        med: styles.colMed,
      };
}

function StartListDoc(props: {
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  generatedAt: string;
  rows: ExportRegistrationRow[];
}) {
  const groups = groupByStartWave(props.rows);
  const location = [props.venue, props.city, props.state].filter(Boolean).join(", ");
  // Merchandise is what the tent hands over, so it belongs on the sheet the
  // volunteers are already holding rather than in a second document.
  const withExtras = props.rows.some((r) => r.addOns !== "");
  const col = columnsFor(withExtras);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{props.eventTitle}</Text>
          <Text style={styles.meta}>
            {[props.eventDate, location].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.meta}>
            Start list · {props.rows.length} athlete{props.rows.length === 1 ? "" : "s"} · Generated{" "}
            {props.generatedAt}
          </Text>
        </View>

        {groups.map((g) => (
          <View key={g.wave}>
            <Text style={styles.waveTitle}>{formatStartListGroupTitle(g)}</Text>
            <View style={styles.tableHeader}>
              <Text style={[col.bib, styles.headerCell]}>Bib</Text>
              <Text style={[col.name, styles.headerCell]}>Name</Text>
              <Text style={[col.category, styles.headerCell]}>Category</Text>
              <Text style={[col.gender, styles.headerCell]}>Gender</Text>
              <Text style={[col.phone, styles.headerCell]}>Emergency phone</Text>
              {withExtras && (
                <>
                  <Text style={[styles.colExtras, styles.headerCell]}>Add-ons</Text>
                  <Text style={[styles.colExtrasPaid, styles.headerCell]}>
                    Add-ons paid (AUD)
                  </Text>
                </>
              )}
              <Text style={[col.med, styles.headerCell]}>Medical</Text>
            </View>
            {g.rows.map((r) => (
              <View key={r.id} style={styles.row} wrap={false}>
                <Text style={col.bib}>{r.bib || "-"}</Text>
                <Text style={col.name}>{r.name}</Text>
                <Text style={col.category}>{r.category || "-"}</Text>
                <Text style={col.gender}>{r.gender || "-"}</Text>
                <Text style={col.phone}>{r.emergencyPhone || "-"}</Text>
                {withExtras && (
                  <>
                    <Text style={styles.colExtras}>{r.addOns || "-"}</Text>
                    {/* Dash rather than 0.00 on an athlete who bought nothing, so
                        a real zero-priced add-on still reads as a figure. */}
                    <Text style={styles.colExtrasPaid}>{r.addOns ? r.addOnsPaidAud : "-"}</Text>
                  </>
                )}
                <Text style={col.med}>{r.hasMedical ? "Yes" : ""}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Startline</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildStartListPdf(opts: {
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  rows: ExportRegistrationRow[];
  generatedAt?: Date;
}): Promise<Buffer> {
  const generatedAt = (opts.generatedAt ?? new Date()).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const buffer = await renderToBuffer(
    <StartListDoc
      eventTitle={opts.eventTitle}
      eventDate={opts.eventDate}
      venue={opts.venue}
      city={opts.city}
      state={opts.state}
      generatedAt={generatedAt}
      rows={opts.rows}
    />,
  );
  return Buffer.from(buffer);
}
