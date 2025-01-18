<template>
  <div class="report-list">
    <h2>Reports</h2>
    <div v-if="!isAuthenticated && !isDashboardPublic">Authentication is required to display the reports.</div>
    <font-awesome-icon class="action-icon" icon="sync" v-on:click="refreshReports()" />
    <div class="report-group" v-for="group in groups" :key="group.name">
      <h3>{{ group.name }}</h3>
      <div class="report-project" v-for="project in group.projects" :key="project.name">
        <h4>{{ project.name }}</h4>
        <div class="report-version" v-for="version in project.versions" :key="version.name">
          <div>
            <h5>{{ version.name }}</h5>
            <font-awesome-icon
              class="action-icon"
              icon="trash-alt"
              v-on:click="deleteVersion(group.name, project.name, version.name)"
              v-if="isAuthenticated"
            />
          </div>
          <div class="report-reports">
            <div class="report-report" v-for="report in version.reports" :key="report.name">
              <div class="report-title">
                <a
                  v-if="report.result.link"
                  target="_blank"
                  :href="getReportUrl(group.name, project.name, version.name, report.name, report.result.link)"
                  >{{ report.name }}</a
                >
                <span v-else>{{ report.name }}</span>
              </div>
              <div class="report-metrics">
                <span v-if="report.result.success" class="report-metric quality-success">
                  <font-awesome-icon icon="check-circle" />
                  x{{ report.result.success }}
                </span>
                <span v-if="report.result.warning" class="report-metric quality-warning">
                  <font-awesome-icon icon="exclamation-triangle" />
                  x{{ report.result.warning }}
                </span>
                <span v-if="report.result.error" class="report-metric quality-error">
                  <font-awesome-icon icon="bomb" />
                  x{{ report.result.error }}
                </span>
                <span v-if="report.result.coverage" class="report-metric">
                  {{ getCoverage(report.result.coverage) }}
                  <font-awesome-icon icon="percentage" />
                </span>
                <span v-if="report.result.total" class="report-metric">All x{{ report.result.total }}</span>
                <div class="report-timing">
                  <div class="report-duration">
                    {{ displayDuration(report.result.duration) }}
                  </div>
                  <div class="report-date">
                    {{ dateToRelative(new Date(report.date)) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import UserService from "../services/UserService";
import ReportService from "../services/ReportService";
import AppConfigService from "@/services/AppConfigService";
import AlertService from "@/services/AlertService";
import { reportsStore } from "@/stores/reports";
import { userAuthenticationStore } from "@/stores/userAuthentication";
import { appConfigStore } from "@/stores/appConfig";
import { defineComponent } from 'vue'

export default defineComponent({
  data() {
    return {
      groups: [] as any[],
      isAuthenticated: false,
      isDashboardPublic: false,
    };
  },
  mounted() {
    const reports = reportsStore();
    reports.$subscribe((mutation, state) => {
      this.groups = state.groups;
    });

    const userAuthentication = userAuthenticationStore();
    userAuthentication.$subscribe((mutation, state) => {
      this.isAuthenticated = state.isAuthenticated;
      this.refreshReports();
    });
    this.isAuthenticated = userAuthentication.isAuthenticated;

    const appConfig = appConfigStore();
    appConfig.$subscribe((mutation, state) => {
      this.isDashboardPublic = state.isDashboardPublic;
      this.refreshReports();
    });
    this.isDashboardPublic = appConfig.isDashboardPublic;

    AppConfigService.refresh();
    UserService.refreshInitializationStatus();
    this.refreshReports();
  },
  methods: {
    async refreshReports() {
      if (this.isDashboardPublic || this.isAuthenticated) {
        await ReportService.refresh();
      }
    },

    async deleteVersion(group: string, project: string, version: string) {
      if (confirm(`Delete version ${version}?`)) {
        try {
          await ReportService.deleteVersion(group, project, version);
          this.refreshReports();
        } catch (err: any) {
          AlertService.send({ text: `ERR: Error deleting version (${err.message})`, type: "error" });
        }
      }
    },

    async checkAuthentication(): Promise<void> {
      await UserService.checkAuthentication().catch((err: Error) => {
        AlertService.send({ text: `ERR: Connection to server failed (${err.message})`, type: "error" });
      });
    },

    getCoverage(coverageInput: any): string {
      if (typeof coverageInput === "number") {
        return coverageInput.toString();
      } else if (typeof coverageInput === "string") {
        return coverageInput.replace("%", "");
      }
      return coverageInput;
    },

    getReportUrl(
      groupName: string,
      projectName: string,
      versionName: string,
      reportName: string,
      reportLink: string
    ): string {
      if (reportLink.indexOf("http") === 0) {
        return reportLink;
      } else {
        return (
          import.meta.env.VITE_APP_BASEPATH_SERVER +
          "/reports_data/" +
          groupName +
          "/" +
          projectName +
          "/" +
          versionName +
          "/" +
          reportName +
          "/report/" +
          reportLink
        );
      }
    },

    dateToRelative(date: Date): string {
      const msPerMinute = 60 * 1000;
      const msPerHour = msPerMinute * 60;
      const msPerDay = msPerHour * 24;
      const msPerMonth = msPerDay * 30;
      const msPerYear = msPerDay * 365;

      const elapsed = new Date().getTime() - date.getTime();

      if (elapsed < msPerMinute) {
        return Math.round(elapsed / 1000) + " sec. ago";
      } else if (elapsed < msPerHour) {
        return Math.round(elapsed / msPerMinute) + " min. ago";
      } else if (elapsed < msPerDay) {
        return Math.round(elapsed / msPerHour) + " h. ago";
      } else if (elapsed < msPerMonth) {
        return Math.round(elapsed / msPerDay) + " days ago";
      } else if (elapsed < msPerYear) {
        return Math.round(elapsed / msPerMonth) + " months ago";
      } else {
        return Math.round(elapsed / msPerYear) + " years ago";
      }
    },

    displayDuration(duration: number): string {
      if (!duration) {
        return "";
      } else if (typeof duration !== "number") {
        return duration;
      } else if (duration < 1000) {
        return Math.round(duration) + " ms";
      } else if (duration < 60 * 1000) {
        return Math.round(duration / 1000) + " s";
      } else if (duration < 3600 * 1000) {
        return Math.round(duration / (60 * 1000)) + " min";
      } else if (duration < 24 * 3600 * 1000) {
        return Math.round(duration / (3600 * 1000)) + " h";
      } else {
        return Math.round(duration / (24 * 3600 * 1000)) + " h";
      }
    },
  },
});
</script>
<style>
.report-project,
.report-version,
.report-reports {
  margin-left: 2vw;
}
.report-version {
  border-top: 2px solid;
}
.report-reports_tmp {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 2em;
  background-color: red;
}
.report-reports {
  display: grid;
  /* grid-template-columns: repeat(auto-fit, 100px); */
  grid-template-columns: repeat(auto-fill, minmax(15em, 1fr));
  gap: 10px;
  margin: 5px;
}
.report-report {
  width: 100%;
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.2);
  padding: 0.4em 0.8em;
  margin-bottom: 0.8em;
  margin-right: 0.8em;
  background-color: #cfd8dc;
}
.report-title {
  font-size: 90%;
  text-align: center;
  width: 100%;
  border-bottom: 2px dotted #888;
  padding-bottom: 0.2em;
  margin-bottom: 0.6em;
}
.report-title a:any-link {
  color: #0d47a1;
  word-wrap: break-word;
}
.report-metrics {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  justify-content: space-between;
}
.report-metric {
  font-size: 90%;
  width: 30%;
  padding-bottom: 0.4em;
}
.report-timing {
  font-size: 70%;
  width: 100%;
  color: #888;
  display: flex;
}
.report-duration {
  width: 50%;
}
.report-date {
  text-align: right;
  width: 50%;
}
.quality-success {
  color: #43a047;
}
.quality-warning {
  color: #ff7043;
}
.quality-error {
  color: #e53935;
}
.action-icon {
  float: right;
  margin-top: -3em;
}

</style>
