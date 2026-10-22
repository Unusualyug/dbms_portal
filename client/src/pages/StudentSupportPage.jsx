import { LifeBuoy } from "lucide-react";
import SectionHeading from "../components/SectionHeading.jsx";
import StudentSupportSection from "../components/StudentSupportSection.jsx";
import "../styles/student-support.css";

export default function StudentSupportPage() {
  return (
    <div className="student-support-page">
      <SectionHeading
        eyebrow="STUDENT SUPPORT DESK"
        title="Contact & Support"
        description="Send a question or suggestion to the portal admin. Replies appear in your support thread; Resend’s email status is shown separately."
        action={
          <span className="soft-badge">
            <LifeBuoy size={15} /> Questions &amp; suggestions
          </span>
        }
      />
      <StudentSupportSection />
    </div>
  );
}
