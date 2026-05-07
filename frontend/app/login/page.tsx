import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "เข้าสู่ระบบ - Assistant Admin",
};

export default function LoginPage() {
  return (
    <section
      className="w-full min-h-screen bg-cover bg-center bg-no-repeat px-4 font-sans flex items-center justify-center"
      style={{
        backgroundImage: "url('https://assets.prebuiltui.com/images/components/hero-section/hero-grid-gradient-img.png')",
      }}
    >
      <LoginForm />
    </section>
  );
}
