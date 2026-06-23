import { redirect } from "next/navigation";

const AdminIndexPage = () => {
  redirect("/admin/quiz-create");
};

export default AdminIndexPage;
