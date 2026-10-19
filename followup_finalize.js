window.KAVRO_DATA = (window.FOLLOWUP_DATA||[]).map(function (r) {
  return { IMEI: r.imei, ID: r.id, Customer: r.fullName, Phone: r.phone, Email: r.email,
    Brand: r.deviceBrand, Model: r.deviceModel, Status: r.lockStatus,
    AssignedTo: r.assignedTo, DaysOverdue: r.daysOverdue, Outstanding: r.outstanding,
    Bucket: r.recoveryBucket, State: r.state, City: r.city,
    FollowUpStatus: r.followUpStatus, Source: r.source };
});
