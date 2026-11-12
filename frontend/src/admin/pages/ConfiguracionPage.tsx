import { AccountSettingsLayout } from "../../components/AccountSettingsLayout";
import { ProfileDetails } from "../../components/ProfileDetails";
import { PasswordSettings } from "../../components/PasswordSettings";
import { useAdminAuthStore } from "../../store/adminAuthStore";

export default function ConfiguracionPage() {
  const { usuario } = useAdminAuthStore();
  if (!usuario) return null;
  return <AccountSettingsLayout usuario={usuario}
    profile={<ProfileDetails usuario={usuario} />}
    password={<PasswordSettings />} />;
}
