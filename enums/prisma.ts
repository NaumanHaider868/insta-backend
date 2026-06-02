enum PrismaErrorCode {
  UniqueConstraintFailed = 'P2002',
  ForeignKeyConstraintFailed = 'P2003',
  RecordNotFound = 'P2025',
  QueryParamMissing = 'P2011',
  NullConstraintViolation = 'P2010',
  RelationViolation = 'P2014',
  RequiredRelationMissing = 'P2016',
  ValueOutOfRange = 'P2004',
  ConstraintViolation = 'P2005',
  InvalidInput = 'P2009',
  TooManyRequests = 'P2034',
}

export { PrismaErrorCode };
