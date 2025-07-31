'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'

export const updateOnboardingStep = async (stepData: {
  linkedinConnected?: boolean
  stripeSubscribed?: boolean
  cardDetailsAdded?: boolean
  onboardingComplete?: boolean
}) => {
  const { userId } = await auth()

  if (!userId) {
    return { error: 'No logged in user' }
  }

  const client = await clerkClient()

  try {
    const currentUser = await client.users.getUser(userId)
    const currentMetadata = currentUser.publicMetadata || {}

    const res = await client.users.updateUser(userId, {
      publicMetadata: {
        ...currentMetadata,
        ...stepData,
      },
    })
    return { success: true, metadata: res.publicMetadata }
  } catch (err) {
    console.error('Error updating user metadata:', err)
    return { error: 'There was an error updating the user metadata.' }
  }
}

export const completeOnboarding = async () => {
  const { userId } = await auth()

  if (!userId) {
    return { error: 'No logged in user' }
  }

  const client = await clerkClient()

  try {
    const res = await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
        linkedinConnected: true,
        stripeSubscribed: true,
        cardDetailsAdded: true,
      },
    })
    return { success: true, metadata: res.publicMetadata }
  } catch (err) {
    console.error('Error completing onboarding:', err)
    return { error: 'There was an error completing onboarding.' }
  }
} 