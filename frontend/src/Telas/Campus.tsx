import { usePageTitle } from "@/hooks/use-page-title";
import campusImage from "@/assets/img_campus_unifor.png";

export default function Campus() {
  usePageTitle("Campus");

  return (
    <div className="p-4">
      <img
        src={campusImage}
        alt="Campus Unifor"
        className="w-full h-[calc(100vh-11rem)] object-cover rounded-md"
      />
    </div>
  );
}
