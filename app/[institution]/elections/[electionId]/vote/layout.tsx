import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Official Ballot Booth • Confidential Polling Area",
  description: "Secure confidential electronic ballot voting session.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function VoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
