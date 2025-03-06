export const DATASETS = {
  flu: {
    shortName: 'flu',
    fullName: 'NC Forecasts',
    views: ['detailed'],
    // views: ['detailed', 'timeseries'],
    defaultView: 'detailed',
    defaultModel: 'FluSight-ensemble',
    hasDateSelector: true,
    hasModelSelector: true,
    prefix: 'flu',
    dataPath: 'flusight'
  },
  // rsv: {
  //   shortName: 'rsv',
  //   fullName: 'RSV Forecast Hub',
  //   views: ['detailed'],
  //   defaultView: 'detailed',
  //   defaultModel: 'hub-ensemble',
  //   hasDateSelector: true,
  //   hasModelSelector: true,
  //   prefix: 'rsv',
  //   dataPath: 'rsv'
  // },
  // nhsn: {
  //   shortName: 'nhsn',
  //   fullName: 'NHSN Raw Data',
  //   views: ['raw'],
  //   defaultView: 'raw',
  //   hasDateSelector: false,
  //   hasModelSelector: false,
  //   prefix: 'nhsn',
  //   dataPath: 'nhsn'
  // }
};

export const VISUALIZATION_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];
