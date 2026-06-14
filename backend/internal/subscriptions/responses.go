package subscriptions

func toPlanResponse(plan SubscriptionPlan) PlanResponse {
	perks := make([]string, len(plan.Perks))
	copy(perks, plan.Perks)
	return PlanResponse{
		PlanType: string(plan.PlanType),
		Name:     plan.Name,
		Perks:    perks,
	}
}

func toMySubscriptionResponse(sub UserSubscription, plan SubscriptionPlan) MySubscriptionResponse {
	perks := make([]string, len(plan.Perks))
	copy(perks, plan.Perks)
	return MySubscriptionResponse{
		PlanType:           string(sub.PlanType),
		Status:             string(sub.Status),
		EntrancesRemaining: sub.EntrancesRemaining,
		EntrancesTotal:     entrancesTotalForPlan(sub.PlanType),
		StartsAt:           sub.StartsAt,
		ExpiresAt:          sub.ExpiresAt,
		Perks:              perks,
	}
}

func entrancesTotalForPlan(planType PlanType) *int {
	if planType != PlanEntrances10 {
		return nil
	}
	total := EntrancesPackSize
	return &total
}
