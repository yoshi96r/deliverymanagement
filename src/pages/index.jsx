import Layout from "./Layout.jsx";

import CarrierDashboard from "./CarrierDashboard";

import CustomerPortal from "./CustomerPortal";

import BusinessSenderDashboard from "./BusinessSenderDashboard";

import BinManagementPage from "./BinManagementPage";

import DriverMobile from "./DriverMobile";

import DispatchDashboard from "./DispatchDashboard";

import BatchPackageEntry from "./BatchPackageEntry";

import AnalyticsDashboard from "./AnalyticsDashboard";

import PackageManagement from "./PackageManagement";

import LabelDesigner from "./LabelDesigner";

import InventoryManagement from "./InventoryManagement";

import DriverManagement from "./DriverManagement";

import HOSManagement from "./HOSManagement";

import DOTCompliance from "./DOTCompliance";

import LoadManagement from "./LoadManagement";

import FleetMaintenance from "./FleetMaintenance";

import DriverNavigation from "./DriverNavigation";

import MailboxManagement from "./MailboxManagement";

import USPSManagement from "./USPSManagement";

import CustomerCommunication from "./CustomerCommunication";

import CustomerMessageDashboard from "./CustomerMessageDashboard";

import AdminControl from "./AdminControl";

import FleetMap from "./FleetMap";

import RoutePlanning from "./RoutePlanning";

import PaymentCenter from "./PaymentCenter";

import ReportsHub from "./ReportsHub";

import IncidentManagement from "./IncidentManagement";

import DocumentVault from "./DocumentVault";

import SystemSettings from "./SystemSettings";

import CustomerSelfService from "./CustomerSelfService";

import Home from "./Home";

import NotificationCenter from "./NotificationCenter";

import CreateShippingLabel from "./CreateShippingLabel";

import BulkOperations from "./BulkOperations";

import HelpCenter from "./HelpCenter";

import AutomationHub from "./AutomationHub";

import TrainingPortal from "./TrainingPortal";

import PublicTracking from "./PublicTracking";

import DriverExpenses from "./DriverExpenses";

import CustomerReturnsPortal from "./CustomerReturnsPortal";

import InsuranceClaimsPortal from "./InsuranceClaimsPortal";

import EmergencyResponseCenter from "./EmergencyResponseCenter";

import DriverCertifications from "./DriverCertifications";

import RecordMyRoute from "./RecordMyRoute";

import FollowRecordedRoute from "./FollowRecordedRoute";

import RoleManagement from "./RoleManagement";

import DemoHome from "./DemoHome";

import BusinessRegistration from "./BusinessRegistration";

import PrivacyPolicy from "./PrivacyPolicy";

import TermsOfService from "./TermsOfService";

import DataSecurity from "./DataSecurity";

import CustomerSignaturePortal from "./CustomerSignaturePortal";

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { createPageUrl } from "@/utils";

const PAGES = {

    CarrierDashboard: CarrierDashboard,

    CustomerPortal: CustomerPortal,

    BusinessSenderDashboard: BusinessSenderDashboard,

    BinManagementPage: BinManagementPage,

    DriverMobile: DriverMobile,

    DispatchDashboard: DispatchDashboard,

    BatchPackageEntry: BatchPackageEntry,

    AnalyticsDashboard: AnalyticsDashboard,

    PackageManagement: PackageManagement,

    LabelDesigner: LabelDesigner,

    InventoryManagement: InventoryManagement,

    DriverManagement: DriverManagement,

    HOSManagement: HOSManagement,

    DOTCompliance: DOTCompliance,

    LoadManagement: LoadManagement,

    FleetMaintenance: FleetMaintenance,

    DriverNavigation: DriverNavigation,

    MailboxManagement: MailboxManagement,

    USPSManagement: USPSManagement,

    CustomerCommunication: CustomerCommunication,

    CustomerMessageDashboard: CustomerMessageDashboard,

    AdminControl: AdminControl,

    FleetMap: FleetMap,

    RoutePlanning: RoutePlanning,

    PaymentCenter: PaymentCenter,

    ReportsHub: ReportsHub,

    IncidentManagement: IncidentManagement,

    DocumentVault: DocumentVault,

    SystemSettings: SystemSettings,

    CustomerSelfService: CustomerSelfService,

    Home: Home,

    NotificationCenter: NotificationCenter,

    CreateShippingLabel: CreateShippingLabel,

    BulkOperations: BulkOperations,

    HelpCenter: HelpCenter,

    AutomationHub: AutomationHub,

    TrainingPortal: TrainingPortal,

    PublicTracking: PublicTracking,

    DriverExpenses: DriverExpenses,

    CustomerReturnsPortal: CustomerReturnsPortal,

    InsuranceClaimsPortal: InsuranceClaimsPortal,

    EmergencyResponseCenter: EmergencyResponseCenter,

    DriverCertifications: DriverCertifications,

    RecordMyRoute: RecordMyRoute,

    FollowRecordedRoute: FollowRecordedRoute,

    RoleManagement: RoleManagement,

    DemoHome: DemoHome,

    BusinessRegistration: BusinessRegistration,

    PrivacyPolicy: PrivacyPolicy,

    TermsOfService: TermsOfService,

    DataSecurity: DataSecurity,

    CustomerSignaturePortal: CustomerSignaturePortal,
};

const defaultPage = "CarrierDashboard";
const defaultLandingPath = createPageUrl(defaultPage);

const pageSlugMap = Object.keys(PAGES).reduce((acc, pageName) => {
    const path = createPageUrl(pageName);
    acc[path] = pageName;
    return acc;
}, { "/": defaultPage });

const pageRoutes = Object.entries(PAGES).map(([pageName, Component]) => ({
    pageName,
    path: createPageUrl(pageName),
    Component,
}));

function _getCurrentPage(pathname) {
    const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, '').toLowerCase();
    return pageSlugMap[normalizedPath] || defaultPage;
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/" element={<Navigate to={defaultLandingPath} replace />} />
                {pageRoutes.map(({ path, Component, pageName }) => (
                    <Route key={pageName} path={path} element={<Component />} />
                ))}
                <Route path="*" element={<Navigate to={defaultLandingPath} replace />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
