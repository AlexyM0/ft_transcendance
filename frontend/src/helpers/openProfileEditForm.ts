// src/views/modals/openProfileEditForm.ts
import { createSplash } from "../";
import { getProfileInitial } from "../../features/profile/selectors";
import { saveMyProfileUseCase } from "../../features/profile/saveMyProfileUseCase";
import { ProfileEditForm } from "../../ui/forms/ProfileEditForm";

export async function openProfileEditForm() {
  const initial = getProfileInitial();
  if (!initial) return;

  const modal = createSplash("Edit Profile");
  const form = ProfileEditForm(initial, {
    onSubmit: async (payload) => {
      await saveMyProfileUseCase(payload);
      form.dispose();
      modal.close();
    },
    onCancel: () => {
      form.dispose();
      modal.close();
    },
  });

  modal.set(form.wrap);
  modal.open();
}
